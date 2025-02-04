import bucket_client as bc
import logger
import sqlite3
import mido
import argparse
import uuid
import os
from scipy.io import wavfile
import numpy as np
import tempfile
import subprocess as sp
import warnings
import parselmouth
import wave
import contextlib
import numpy as np
from functools import partial
import db_queries as dbq
import audio_conversion as ac
from crop_sampler import CropSampler
import pyloudnorm as pyln

BUCKET_NAME = os.environ.get('k9_bucket_name', 'song_barker_sequences')
samplerate = 44100
log = logger.log_fn(os.path.basename(__file__))


def to_sequence (user_id, song_id, crops, debug=False, output=None):
    log(' '.join(crops), 'started')

    sequence_count = dbq.get_sequence_count(user_id, song_id)

    with tempfile.TemporaryDirectory() as tmp_dir:

        # assuming all crops come from same raw...
        raw_fk = dbq.get_crop_raw_fk(crops[0])

        # instantiate crop objects
        crop_objs = [dbq.crop_sampler_from_uuid(crop, tmp_dir) for crop in crops]
        if debug:
            for co in crop_objs:
                #co.play_original()
                print(co)
                print('crop audio data: min {} max {} dtype {}'.format(co.audio_data.min(), co.audio_data.max(), co.audio_data.dtype))
                co.play_original()
            pass

        # instatiate the midi object
        mb = dbq.midi_bridge_from_song_id(song_id, tmp_dir)
        song = dbq.get_song(song_id)

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

        # persistence
        remote_sequence_fp = '{}/sequences/{}.aac'.format(raw_fk, sequence_uuid)
        remote_sequence_url = 'gs://{}/{}'.format(BUCKET_NAME, remote_sequence_fp)
        song_name = dbq.get_song_name(song_id)
        if backing_fp:
            backing_url = 'gs://{}/{}'.format(BUCKET_NAME, backing_fp)
        else:
            backing_url = None
        dbq.db_insert('sequences', **{
            'uuid': str(sequence_uuid),
            'song_id': song_id,
            'crop_id': ' '.join(crops),
            'user_id': user_id,
            'name': '{} {}'.format(song_name, sequence_count + 1),
            'bucket_url': remote_sequence_url,
            'bucket_fp': remote_sequence_fp,
            'backing_track_fp': backing_fp,
            'backing_track_url': backing_url,
            'stream_url': None,
            'hidden': 0,
        })
        if not debug:
            bc.upload_filename_to_bucket(sequence_fp_aac, remote_sequence_fp)
        else:
            print('WARNING: debug enabled, skipping uploading file to bucket')

        if debug:
            for crop in crop_objs:
                #print(crop)
                pass
            print('looking for backing track at', backing_fp)
            if backing_fp:
                local_backing = os.path.join(tmp_dir, 'backing.aac')
                bc.download_filename_from_bucket(backing_fp, local_backing)
                cmd = 'ffplay -f lavfi -i "amovie={}[01];amovie={}[02];[01][02]amerge"'.format(
                    sequence_fp,
                    local_backing
                )
                sp.call(cmd, shell=True)
            else:
                #sp.call('play {}'.format(sequence_fp), shell=True)
                pass

            if output:
                cmd = 'ffmpeg -i {} -i {} -y -filter_complex amix=inputs=2:duration=longest {}'.format(
                    sequence_fp,
                    local_backing,
                    output
                )
                sp.call(cmd, shell=True)


        # return some data for api response
        print(sequence_uuid, remote_sequence_url)
        log(' '.join(crops), 'finished')


if __name__ == '__main__':

    parser = argparse.ArgumentParser()
    #parser.add_argument('--midi-file', '-m', help='midi file')
    parser.add_argument('--user-id', '-u', help='the user id', type=str)
    parser.add_argument('--song-id', '-s', help='the song id', type=str, default=1)
    parser.add_argument('--crops', '-c', nargs='+', help='crops used for each instrument, in track order')
    parser.add_argument('--debug', '-d', action='store_true', help='playback audio crops', default=False)
    parser.add_argument('--output', '-o', help='output locally', type=str)
    args = parser.parse_args()

    if not args.debug:
        warnings.filterwarnings('ignore')

    # TODO maybe lint args?
    to_sequence(args.user_id, args.song_id, args.crops, args.debug, args.output)
