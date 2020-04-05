import datetime as dt
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

samplerate = 44100
log = logger.log_fn(os.path.basename(__file__)) 


def to_sequence (user_id, song_id, crops, debug=False):
    log(' '.join(crops), 'started')

    sequence_count = dbq.get_sequence_count(user_id, song_id)

    with tempfile.TemporaryDirectory() as tmp_dir:

        # assuming all crops come from same raw...
        raw_fk = dbq.get_crop_raw_fk(crops[0])

        # instantiate crop objects
        crop_objs = [dbq.crop_sampler_from_uuid(crop, tmp_dir) for crop in crops]

        # instatiate the midi object
        mb = dbq.midi_bridge_from_song_id(song_id, tmp_dir)
        song = dbq.get_song(song_id)

        # try to determine the ideal key
        pitches = np.array([note['pitch'] for note in mb.melody_track])
        shifts = np.arange(-100, 100)
        pitch_shifts = np.array([
            pitches + np.full(pitches.shape, shift)
            for shift in shifts
        ])
        crop_pitch = np.full(pitch_shifts.shape, crop_objs[0].nearest_pitch)
        pitch_diffs = np.absolute(pitch_shifts - crop_pitch)
        min_idx = np.argmin(np.sum(pitch_diffs, axis=1))

        # the absolute transposition that we think is the "best"
        min_shift = shifts[min_idx]

        # put the song in the key that this shift implies
        backing_fp = None
        backing_shift = min_shift % 12
        if backing_shift < 0:
            backing_shift += 12
        if song.get('backing_track'):
            backing_fp = 'backing_tracks/{}/{}.aac'.format(
                song.get('backing_track'),
                (song.get('key') + backing_shift) % 12
            )
            

        # generate the actual audio for each track
        track_sequences = []
        # TODO this is horrible
        track_types = ['rhythm' for _ in range(len(mb.track_notes))]
        track_types[0] = 'melody'
        for crop, track, track_type in zip(crop_objs, mb.track_notes, track_types):
            if track_type == 'rhythm':
                min_shift = 0
            # start with the length of the song in samples, for initializing
            # empty audio tracks
            total_samples = mb.total_samples(samplerate)

            # need audio padding for crop offset timing
            audio_padding = samplerate * 2

            # initialize an array with zeros that is the length of the song
            track_sequence = np.zeros((total_samples + audio_padding,))

            # splice in audio data for each crop sample by sample index
            for note in track:
                # notes with pitch <= 12 are considered rhythm notes, so the pitch is unchanged
                # notes with duration longer than the original crop are
                # rendered with the crop's original duration (this logic is in the CropSampler)

                # get the crop sampler's rendering of the crop at specified pitch and duration
                # dont shift non melody tracks
                audio_data = crop.to_pitch_duration(
                    note['pitch'] + min_shift,
                    mb.ticks_to_seconds(note['duration'])
                )

                # calculate sample offset so peak intesity falls on beat
                # start with initial crop's peak
                peak_time = crop.peak()
                duration = crop.duration()

                # scale it by the duration of the sample
                peak_pct = peak_time / duration

                # get the number of samples from the beginning of the audio data to the peak
                peak_offset = int(len(audio_data) * peak_pct)

                # determine the number of samples needed before the note starts in the track
                # (this will get adjusted below based on the peak of the sample)
                rest_samples = mb.ticks_to_samples(note['time'], samplerate)

                # add some padding so that samples that start at the beginning
                # but have a late peak still have room to exist in full
                # (this is just accounting for that, not actually adding it)
                rest_samples += audio_padding

                # subtrack that number from the number of rest samples before the audio data
                rest_samples -= peak_offset

                # splice the audio data in to the track data the determined time
                track_sequence[rest_samples:rest_samples + len(audio_data)] += audio_data

            track_sequence /= track_sequence.max()
            track_sequences.append(track_sequence)

        # combine tracks into single array
        sequence_uuid = uuid.uuid4()
        sequence_fp = os.path.join(tmp_dir, '{}.wav'.format(sequence_uuid))
        sequence_length = max([len(track) for track in track_sequences])
        sequence = np.zeros((sequence_length,))
        for track in track_sequences:
            sequence[0:len(track)] += track
        sequence /= sequence.max()

        # crop beginning silence
        start_idx = 0
        for s in sequence:
            start_idx += 1
            if s > 0:
                break
        sequence = sequence[start_idx:]

        # write to file
        wavfile.write(sequence_fp, samplerate, sequence)
        sequence_fp_aac = ac.wav_to_aac(sequence_fp)

        # persistence
        remote_sequence_fp = '{}/sequences/{}.aac'.format(raw_fk, sequence_uuid)
        remote_sequence_url = 'gs://song_barker_sequences/{}'.format(remote_sequence_fp)
        song_name = dbq.get_song_name(song_id)
        if backing_fp:
            backing_url = 'gs://song_barker_sequences/' + backing_fp
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
            'backing_track_url': backing_url,
            'stream_url': None,
            'hidden': 0,
        })
        bc.upload_filename_to_bucket(sequence_fp_aac, remote_sequence_fp)

        if debug:
            for crop in crop_objs:
                print(crop)
            if backing_fp:
                local_backing = os.path.join(tmp_dir, 'backing.aac')
                bc.download_filename_from_bucket(backing_fp, local_backing)
                cmd = 'ffplay -f lavfi -i "amovie={}[01];amovie={}[02];[01][02]amerge"'.format(
                    sequence_fp,
                    local_backing
                )
                sp.call(cmd, shell=True)
            else:
                sp.call('play {}'.format(sequence_fp), shell=True)

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
    args = parser.parse_args()

    if not args.debug:
        warnings.filterwarnings('ignore')

    # TODO maybe lint args?
    to_sequence(args.user_id, args.song_id, args.crops, args.debug)
