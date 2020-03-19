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

warnings.filterwarnings('ignore')
log = logger.log_fn(os.path.basename(__file__)) 


parser = argparse.ArgumentParser()
#parser.add_argument('--midi-file', '-m', help='midi file')
parser.add_argument('--user-id', '-u', help='the user id', type=str)
parser.add_argument('--song-id', '-s', help='the song id', type=str, default=1)
parser.add_argument('--crops', '-c', nargs='+', help='crops used for each instrument, in track order')
parser.add_argument('--debug', '-d', action='store_true', help='playback audio crops', default=False)
args = parser.parse_args()


def get_sequence_count (cur, user_id, song_name):
    sequence_count_sql = '''
        SELECT count(*) from sequences 
        WHERE 
            user_id = :user_id
        AND
            name like :song_name
        ;
    '''
    cur.execute(sequence_count_sql, {
        'user_id': user_id,
        'song_name': '%{}%'.format(song_name),
    })
    try:
        sequence_count = int(cur.fetchone()[0])
    except:
        sequence_count = 0
        if args.debug:
            print('got exception when trying to get sequence count')
    return sequence_count


def aac_to_wav (aac_fp):
    with warnings.catch_warnings():
        wav_fp = aac_fp.replace('.aac', '.wav')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(aac_fp, wav_fp), shell=True)
    return wav_fp


def wav_to_aac (wav_fp):
    with warnings.catch_warnings():
        aac_fp = wav_fp.replace('.wav', '.aac')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(wav_fp, aac_fp), shell=True)
    return aac_fp


def midi_message_to_dict ():
    '''
    turns midi events into note dictionaries with intuitive
    duration and time
    '''
    _notes = {}
    _time = 0

    def handle_message (msg):
        nonlocal _notes
        nonlocal _time
        _time += msg.time
        if msg.type == 'note_on':
            _notes[msg.note] = {
                'pitch': msg.note,
                'velocity': msg.velocity,
                'time': _time,
                'duration': 0,
            }
        if msg.type == 'note_off':
            note = _notes[msg.note]
            note['duration'] = _time - note['time']
            del _notes[msg.note]
            return note

    return handle_message


def ticks_to_seconds (mid, ticks):
    '''
    The formula is 60000 / (BPM * PPQ) (milliseconds).
    Where BPM is the tempo of the track (Beats Per Minute).
    (i.e. a 120 BPM track would have a MIDI time of (60000 / (120 * 192)) or 2.604 ms for 1 tick.
    '''
    tick_duration = (60000 / (120 * mid.ticks_per_beat)) # in milliseconds
    return (tick_duration * ticks) / 1000


def ticks_to_samples (samplerate, mid, ticks):
    seconds = ticks_to_seconds(mid, ticks)
    samples = int(seconds * samplerate)
    return samples


def to_pd (note):
    return note['pitch'], note['duration']


if __name__ == '__main__':
    samplerate = 16000

    # load the song from the db
    conn = sqlite3.connect('../server/barker_database.db')
    cur = conn.cursor()

    # show sql if debug
    if args.debug:
        conn.set_trace_callback(print)

    #cur.execute('SELECT name, data FROM songs where id = :song_id', {
    #    'song_id': args.song_id,
    #})
    #song_name, song_data = cur.fetchone()
    #song_data = eval(song_data)
    #if args.debug:
    #    print('song name', song_name, 'song data', song_data)

    with tempfile.TemporaryDirectory() as tmp_dir:
        # download all crops and convert to wav
        crop_wavs = {}
        for crop in args.crops:
            cur.execute('select bucket_fp, uuid, raw_id from crops where uuid = ?', [crop])
            remote_fp, crop_fk, raw_fk = cur.fetchone()
            crop_aac = os.path.join(tmp_dir, '{}.aac'.format(crop))
            bc.download_filename_from_bucket(remote_fp, crop_aac)
            # convert aac to wav and store the wav fp in the crop dict
            crop_wav[crop] = aac_to_wav(crop_aac)


        # TODO different crops need to be in tune!
        # find what pitch each crop is closest to (ignore octave)
        # calculate adjustment needed to get other pitches within the 12 tone scale
        # determine root that minimizes shifting

        # load the song midi file
        mid = mido.MidiFile(filename=args.midi_file)

        # store rendered audio for each track here
        # in prep for joining together in final sequence
        track_datas = []

        # each track corresponds to a crop
        # TODO handle mismatch in count
        # TODO smarter way to omit non sequence tracks
        for crop, track in zip(args.crops, mid.tracks[1:]):
            msg_to_dict = midi_message_to_dict()
            msgs = [msg for msg in track if msg.type in ['note_on', 'note_off']]
            notes = []
            # parse into convenient format
            for msg in msgs:
                if msg.type == 'note_on':
                    msg_to_dict(msg)
                if msg.type == 'note_off':
                    note = msg_to_dict(msg)
                    notes.append(note)

            if len(notes) < 1:
                continue

            # figure out unique pitch-duration combos
            pitch_durations = list(set([to_pd(note) for note in notes]))

            # TODO this will be replaced when handling multi crop tuning
            pitch_midpoint = int(np.average([pd[0] for pd in pitch_durations]))

            # render crops based on needed pitch durations
            crop_map = {}
            for pd in pitch_durations:
                pitch, duration_ticks = pd
                duration = ticks_to_seconds(mid, duration_ticks)
                out_fp = os.path.join(tmp_dir, 'out.wav')
                # need note and crop duration
                rate, audio_data = wavfile.read(crop_wavs[crop])
                crop_duration = len(audio_data) / rate
                rubberband_args = {
                    'pitch': pitch - pitch_midpoint,
                    'duration': duration / crop_duration, 
                    'crop_fp': crop_wavs[crop], 
                    'out_fp': out_fp,
                }
                sp.call('rubberband -q -p {pitch} -t {duration} {crop_fp} {out_fp}'.format(
                    **rubberband_args
                ), shell=True)
                rate, audio_data = wavfile.read(out_fp)
                # store the np array of the audio file
                crop_map[pd] = audio_data

            # stitch renders together based on track events
            # add renders and the right spots
            # need time to sample_idx ()
            track_ticks = max([note['duration'] + note['time'] for note in notes])
            track_seconds = ticks_to_seconds(mid, track_ticks)
            track_samples = int(track_seconds * samplerate) + 1
            

            # initialize an array with zeros that is the length of the track
            sequence = np.zeros((track_samples,))

            # pop audio in by sample index
            for note in notes:
                rest_samples = ticks_to_samples(samplerate, mid, note['time'])
                audio = crop_map[to_pd(note)]
                sequence[rest_samples:rest_samples + len(audio)] += audio

            # normalize and write
            sequence /= sequence.max()
            wavfile.write(track_render_fp, samplerate, sequence)
            track_datas.append(sequence)

        # combine tracks into single array
        # save as wav
        # convert to aac
        # name and save to db
        # upload to bucket

        #combined_fp_aac = wav_to_aac(combined_fp)
        #sequence_uuid = uuid.uuid4()
        #remote_sequence_fp = '{}/sequences/{}.aac'.format(raw_fk, sequence_uuid)
        #remote_sequence_url = 'gs://song_barker_sequences/{}'.format(remote_sequence_fp)
        #cur.execute('''
        #        INSERT INTO sequences VALUES (
        #            :uuid,
        #            :song_id,
        #            :crop_id,
        #            :user_id,
        #            :name,
        #            :bucket_url,
        #            :bucket_fp,
        #            :stream_url,
        #            :hidden
        #        )
        #    ''', 
        #    {
        #        'uuid': str(sequence_uuid),
        #        'song_id': args.song_id,
        #        'crop_id': args.crop_uuid,
        #        'user_id': args.user_id, 
        #        'name': '{} {}'.format(song_name, sequence_count + 1),
        #        'bucket_url': remote_sequence_url,
        #        'bucket_fp': remote_sequence_fp,
        #        'stream_url': None,
        #        'hidden': 0,
        #    }
        #)
        #bc.upload_filename_to_bucket(combined_fp_aac, remote_sequence_fp)
