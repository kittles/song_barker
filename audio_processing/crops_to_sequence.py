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
from functools import partial
import audio_conversion as ac
from crop_sampler import CropSampler
from midi_bridge improt MidiBridge


warnings.filterwarnings('ignore')
log = logger.log_fn(os.path.basename(__file__)) 


parser = argparse.ArgumentParser()
#parser.add_argument('--midi-file', '-m', help='midi file')
parser.add_argument('--user-id', '-u', help='the user id', type=str)
parser.add_argument('--song-id', '-s', help='the song id', type=str, default=1)
parser.add_argument('--crops', '-c', nargs='+', help='crops used for each instrument, in track order')
parser.add_argument('--debug', '-d', action='store_true', help='playback audio crops', default=False)
args = parser.parse_args()


def crop_sampler_from_uuid (uuid):
    cur.execute('select bucket_fp, uuid, raw_id from crops where uuid = ?', [uuid])
    remote_fp, crop_fk, raw_fk = cur.fetchone()
    crop_aac = os.path.join(tmp_dir, '{}.aac'.format(crop))
    if args.debug:
        print(remote_fp, crop_aac)
    bc.download_filename_from_bucket(remote_fp, crop_aac)
    # convert aac to wav and store the wav fp in the crop dict
    wav_fp = aac_to_wav(crop_aac)
    return CropSampler(wav_fp)


def midi_bridge_from_song_id (song_id, tmp_dir):
    cur.execute('SELECT name, bucket_fp FROM songs where id = :song_id', {
        'song_id': args.song_id,
    })
    song_name, song_fp = cur.fetchone()
    if args.debug:
        print('song name', song_name);
    return MidiBridge(song_fp, tmp_dir, True)


def to_sequence (crop_obs, midi_bridge):
    log(' '.join(args.crops), 'started')

    # TODO db query file
    ## load the song from the db
    #conn = sqlite3.connect('../server/barker_database.db')
    #cur = conn.cursor()

    ## show sql if debug
    #if args.debug:
    #    conn.set_trace_callback(print)

    #cur.execute('SELECT name, bucket_fp FROM songs where id = :song_id', {
    #    'song_id': args.song_id,
    #})
    #song_name, song_fp = cur.fetchone()
    #if args.debug:
    #    print('song name', song_name);

    #sequence_count = get_sequence_count(cur, args.user_id, song_name)

    with tempfile.TemporaryDirectory() as tmp_dir:

        # instantiate crop objects
        crop_objs = [crop_sampler_from_uuid(uuid, tmp_dir) for uuid in args.crops]
        midi = midi_bridge_from_song_id(args.song_id, tmp_dir)

        # TODO
        # do a little math to decide what key to put the midi file in...

        # generate the actual audio for each track
        track_sequences = []
        for crop, track in zip(crop_objs, track_notes):
            # TODO what if crops have different sample rates...
            # need audio padding for crop offset timing
            audio_padding = crop.samplerate() * 2

            # initialize an array with zeros that is the length of the track
            track_sequence = np.zeros(
                (midi.total_samples(crop.samplerate()) + audio_padding, )
            )

            # pop audio in by sample index
            for note in track:
                audio_data = crop.to_pitch_duration(note['pitch'], ticks_to_seconds(mid, note['duration']))
                rest_samples = ticks_to_samples(samplerate, mid, note['time'])
                rest_samples += audio_padding
                # calculate sample offset so peak intesity falls on beat
                # TODO this can fail
                peak_time = crop.peak()
                duration = crop.duration()
                peak_pct = peak_time / duration
                peak_offset = int(len(audio_data) * peak_pct)
                # duration influences peak time
                rest_samples -= peak_offset
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
        # TODO how will this work with a backing track
        start_idx = 0
        for s in sequence:
            start_idx += 1
            if s > 0:
                break
        sequence = sequence[start_idx:]

        # write to file
        wavfile.write(sequence_fp, samplerate, sequence)
        sequence_fp_aac = wav_to_aac(sequence_fp)

        # persistence
        remote_sequence_fp = '{}/sequences/{}.aac'.format(raw_fk, sequence_uuid)
        remote_sequence_url = 'gs://song_barker_sequences/{}'.format(remote_sequence_fp)
        cur.execute('''
                INSERT INTO sequences VALUES (
                    :uuid,
                    :song_id,
                    :crop_id,
                    :user_id,
                    :name,
                    :bucket_url,
                    :bucket_fp,
                    :stream_url,
                    :hidden
                )
            ''', 
            {
                'uuid': str(sequence_uuid),
                'song_id': args.song_id,
                'crop_id': ' '.join(args.crops),
                'user_id': args.user_id, 
                'name': '{} {}'.format(song_name, sequence_count + 1),
                'bucket_url': remote_sequence_url,
                'bucket_fp': remote_sequence_fp,
                'stream_url': None,
                'hidden': 0,
            }
        )
        bc.upload_filename_to_bucket(sequence_fp_aac, remote_sequence_fp)
        conn.commit()

        if args.debug:
            for crop in crop_objs:
                print(crop)
            sp.call('play {}'.format(sequence_fp), shell=True)

        # return some data for api response
        print(sequence_uuid, remote_sequence_url)
        log(' '.join(args.crops), 'finished')
