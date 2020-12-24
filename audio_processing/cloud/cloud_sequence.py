import json
import sqlite3
import mido
import argparse
import uuid
import os
import tempfile
from scipy.io import wavfile
import numpy as np
import subprocess as sp
import numpy as np
import bucket_client as bc
import audio_conversion as ac
from crop_sampler import CropSampler
from midi_bridge import MidiBridge


samplerate = 44100
#log = logger.log_fn(os.path.basename(__file__))


# need scripts
# - midi_bridge.py
# - crop_sampler.py

# needed libs
# - parselmouth
# - mido

# needed args
# - song (full object)
# - crop array (full crop objects)

def to_sequence (song, crops, bucket_name, debug=False, output=None):
    #log(' '.join(crops), 'started')

    #sequence_count = dbq.get_sequence_count(user_id, song_id)

    with tempfile.TemporaryDirectory() as tmp_dir:

        # assuming all crops come from same raw...
        #raw_fk = dbq.get_crop_raw_fk(crops[0])

        # instantiate crop objects
        # TODO rewrite this to not use dbq
        #def crop_sampler_from_uuid (uuid, tmp_dir):
        #    cur.execute('SELECT bucket_fp FROM crops WHERE uuid = ?', [uuid])
        #    row = cur.fetchone()
        #    crop_aac = os.path.join(tmp_dir, '{}.aac'.format(uuid))
        #    bc.download_filename_from_bucket(row['bucket_fp'], crop_aac)
        #    wav_fp = ac.aac_to_wav(crop_aac)
        #    #import subprocess as sp
        #    #sp.call('ffmpeg -i {}'.format(wav_fp), shell=True)
        #    #sp.call('play {}'.format(wav_fp), shell=True)
        #    return CropSampler(wav_fp, tmp_dir)

        def crop_sampler_from_obj (crop_json):
            # make a local path for the bucket download
            crop_aac = os.path.join(tmp_dir, '{}.aac'.format(crop_json['uuid']))
            # download to that path
            bc.download_file_from_bucket(crop_json['bucket_fp'], crop_aac, bucket_name)
            # convert to a wav
            wav_fp = ac.aac_to_wav(crop_aac)
            # use wav to create sampler
            return CropSampler(wav_fp, tmp_dir)

        crop_objs = [crop_sampler_from_obj(crop_json) for crop_json in crops]

        #if debug:
        #    for co in crop_objs:
        #        #co.play_original()
        #        print(co)
        #        print('crop audio data: min {} max {} dtype {}'.format(co.audio_data.min(), co.audio_data.max(), co.audio_data.dtype))
        #        co.play_original()
        #    pass

        # instatiate the midi object
        #def midi_bridge_from_song_id (song_id, tmp_dir):
        #    cur.execute('SELECT name, bucket_fp FROM songs WHERE id = :song_id', {
        #        'song_id': song_id,
        #    })
        #    row = cur.fetchone()
        #    return MidiBridge(row['bucket_fp'], tmp_dir, True)

        #mb = dbq.midi_bridge_from_song_id(song_id, tmp_dir)
        mb = MidiBridge(song['bucket_fp'], tmp_dir, bucket_name)
        #song = dbq.get_song(song_id)

        # try to determine the ideal key
        median_pitch = 0 # for relatively pitched tracks
        if mb.melody_track is not None:
            melody_crop = crop_objs[0]
            crop_pitch = melody_crop.nearest_pitch

            # if we cant get a pitch on the input sound, do relative pitch
            if not mb.melody_track['nopitch']:
                if crop_pitch is None:
                    mb.melody_track['relativepitch'] = True
                    crop_pitch = 60

            pitches = np.array([note['pitch'] for note in mb.melody_track['notes']])
            median_pitch = int(np.median(pitches))

            shifts = np.arange(-100, 100)
            pitch_shifts = np.array([
                pitches + np.full(pitches.shape, shift)
                for shift in shifts
            ])
            crop_pitch_arr = np.full(pitch_shifts.shape, crop_pitch)
            pitch_diffs = np.absolute(pitch_shifts - crop_pitch_arr)
            min_idx = np.argmin(np.sum(pitch_diffs, axis=1))

            # the absolute transposition that we think is the "best"
            min_shift = shifts[min_idx]
        else:
            # no melody track so dont shift anything
            min_shift = 0

        # put the song in the key that this shift implies
        # dont do anything if its a relatively pitched track
        backing_fp = None
        if song.get('backing_track'):
            if not mb.melody_track or mb.melody_track['relativepitch']:
                # dont tune
                backing_fp = 'backing_tracks/{}/{}.aac'.format(
                    song.get('backing_track'),
                    song.get('key')
                )
            else:
                # tune backing track if the melody is absolutely pitched
                backing_shift = min_shift % 12
                if backing_shift < 0:
                    backing_shift += 12
                backing_fp = 'backing_tracks/{}/{}.aac'.format(
                    song.get('backing_track'),
                    (song.get('key') + backing_shift) % 12
                )


        # generate the actual audio for each track
        track_sequences = []
        for crop, track in zip(crop_objs, mb.tracks):
            # start with the length of the song in samples, for initializing
            # empty audio tracks
            total_samples = mb.total_samples(samplerate)

            # need audio padding for crop offset timing
            # this just determines how many samples are going to be used
            audio_padding = samplerate * 2

            # initialize an array with zeros that is the length of the song
            # plus the audio padding
            # this may be very sus, so TODO: look into a better methodolgy...
            # use int32 arrays to avoid overflow
            # then clamp mins and maxes to max for int16, and convert back to int16
            # for output to file
            track_sequence = np.zeros((total_samples + audio_padding,), dtype=np.int32) #TODO crops need to be all int16!!

            # splice in audio data for each crop sample by sample index
            for note in track['notes']:
                # notes with duration longer than the original crop are
                # rendered with the crop's original duration (this logic is in the CropSampler)

                # get the crop sampler's rendering of the crop at specified pitch and duration
                # dont shift non melody tracks
                if track['nopitch']:
                    audio_data = crop.to_duration(
                        mb.ticks_to_seconds(note['duration'])
                    )
                elif track['relativepitch']:
                    audio_data = crop.to_relative_pitch_duration(
                        note['pitch'] - median_pitch,
                        mb.ticks_to_seconds(note['duration'])
                    )
                else:
                    audio_data = crop.to_pitch_duration(
                        note['pitch'] + min_shift,
                        mb.ticks_to_seconds(note['duration'])
                    )

                # calculate sample offset so peak intesity falls on beat
                # get the relative spot of the peak
                # this is a percent, so it is independent of sample stretching or squishing
                # in theory
                peak_pct = crop.peak()

                # get the number of samples from the beginning of the audio data to the peak
                # (audio_data is the pitch / duration shifted result)
                peak_offset = int(len(audio_data) * peak_pct)

                # determine the number of samples needed before the note starts in the track
                # (this will get adjusted below based on the peak of the sample)
                # if we put the sound in at this point, it would be late in most cases,
                # as the peak is not usually the first sample
                rest_samples = mb.ticks_to_samples(note['time'], samplerate)

                # add some padding so that samples that start at the beginning
                # but have a late peak still have room to exist in full
                # (this is just accounting for that, not actually adding it)
                # another way of thinking about this is now we are shifting the sound
                # later in time, by the length of the audio padding
                rest_samples += audio_padding

                # subtract that number from the number of rest samples before the audio data
                # finally shift the sound back in time a bit, so that
                # the peak of the sound (instead of the first sample of the sound)
                # lines up with the note time
                rest_samples -= peak_offset

                # rest_samples now represents the number of samples from the beginning
                # of the track to the point where the first sample of the sound should be

                # splice the audio data in to the track data the determined time
                #if debug:
                #    print(crop)
                #    print('len splice point', len(track_sequence[rest_samples:rest_samples + len(audio_data)]))
                #    print('len audio data', len(audio_data))
                #    print('rest samples start', rest_samples)
                #    print('track sequence length', len(track_sequence))

                # if there is a long sample at the very end, add some more room for it
                if len(track_sequence) < (rest_samples + len(audio_data)):
                    padding = (rest_samples + len(audio_data)) - len(track_sequence)
                    track_sequence = np.concatenate((track_sequence, np.zeros(padding, dtype=np.int32)))

                track_sequence[rest_samples:rest_samples + len(audio_data)] += audio_data

            # NOTE: since samples should already be mastered, dont mess with the levels anymore
            #track_sequence /= track_sequence.max()
            track_sequences.append(track_sequence)
            if debug:
                print('track range', min(track_sequence), max(track_sequence))

        # combine tracks into single array
        sequence_uuid = uuid.uuid4()
        sequence_fp = os.path.join(tmp_dir, '{}.wav'.format(sequence_uuid))
        sequence_length = max([len(track) for track in track_sequences])
        sequence = np.zeros((sequence_length,), dtype=np.int32)
        for track in track_sequences:
            sequence[0:len(track)] += track
        # do the clamping (this was in response to some sequences having overflow problems
        if debug:
            print('int32 sequence range', min(sequence), max(sequence))
        ii16 = np.iinfo(np.int16)
        np.clip(sequence, ii16.min, ii16.max, out=sequence)
        sequence = sequence.astype(np.int16) # back to int16 fingers crossed

        if debug:
            print('full sequence min and max', min(sequence), max(sequence), sequence.dtype)

        # NOTE again, dont mess with levels!
        #sequence /= sequence.max()

        # unshift audio padding
        sequence = sequence[audio_padding:]

        if debug:
            print('sequence min {} max {} dtype {}'.format(sequence.min(), sequence.max(), sequence.dtype))

        # write to file
        wavfile.write(sequence_fp, samplerate, sequence)
        if debug and output:
            # this is just the crops, no backing
            wavfile.write(output.replace('aac', 'wav'), samplerate, sequence)
        sequence_fp_aac = ac.wav_to_aac(sequence_fp)

        ## persistence

        #song_name = dbq.get_song_name(song_id)
        if backing_fp:
            backing_url = 'gs://{}/{}'.format(bucket_name, backing_fp)
        else:
            backing_url = None

        # upload sequence to bucket
        if not debug:
            raw_fk = crops[0]['raw_id']
            # this has to match whatever the server generates for fp as well...
            remote_sequence_fp = '{}/sequences/{}.aac'.format(raw_fk, sequence_uuid)
            remote_sequence_url = 'gs://{}/{}'.format(bucket_name, remote_sequence_fp)
            bc.upload_file_to_bucket(sequence_fp_aac, remote_sequence_fp, bucket_name)
        else:
            print('WARNING: debug enabled, skipping uploading file to bucket')

        #if debug:
        #    for crop in crop_objs:
        #        #print(crop)
        #        pass
        #    print('looking for backing track at', backing_fp)
        #    if backing_fp:
        #        local_backing = os.path.join(tmp_dir, 'backing.aac')
        #        bc.download_filename_from_bucket(backing_fp, local_backing)
        #        cmd = 'ffplay -f lavfi -i "amovie={}[01];amovie={}[02];[01][02]amerge"'.format(
        #            sequence_fp,
        #            local_backing
        #        )
        #        sp.call(cmd, shell=True)
        #    else:
        #        #sp.call('play {}'.format(sequence_fp), shell=True)
        #        pass

        #    if output:
        #        cmd = 'ffmpeg -i {} -i {} -y -filter_complex amix=inputs=2:duration=longest {}'.format(
        #            sequence_fp,
        #            local_backing,
        #            output
        #        )
        #        sp.call(cmd, shell=True)

        response_data = {
            'data': {
                'uuid': str(sequence_uuid),
                'song_id': song['id'],
                'crop_id': ' '.join([c['uuid'] for c in crops]),
                # NOTE these happen server side
                #'user_id': user_id,
                #'name': '{} {}'.format(song['name'], sequence_count + 1),
                'bucket_url': remote_sequence_url,
                'bucket_fp': remote_sequence_fp,
                'backing_track_fp': backing_fp,
                'backing_track_url': backing_url,
                'stream_url': None,
                'hidden': 0,
            },
        }

        # return some data for api response
        print(json.dumps(response_data))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--song', '-s', help='the song id', type=str)
    parser.add_argument('--crops', '-c', help='crops used for each instrument, in track order', type=str)
    parser.add_argument('--debug', '-d', action='store_true', help='playback audio crops', default=False)
    parser.add_argument('--bucket', '-b', help='bucket name')
    args = parser.parse_args()

    song_obj = json.loads(args.song)
    crop_objs = json.loads(args.crops)
    to_sequence(song_obj, crop_objs, args.bucket)
