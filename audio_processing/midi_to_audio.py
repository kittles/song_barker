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
        try:
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
        except:
            print(msg, _notes)

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
    try:
        return note['pitch'], note['duration']
    except:
        return None, None
       

def estimate_peak (wav_fp):
    snd = parselmouth.Sound(wav_fp)
    intensity = snd.to_intensity()
    xs = intensity.xs()
    ivs = intensity.values[0]
    chunks = [np.sum(ivs[i:i+3]) for i in range(len(ivs) - 5)]
    peak = np.max(chunks)
    peak_idx = chunks.index(peak)
    return {
        'peak': peak,
        'peak_time': xs[peak_idx],
    }
       

def estimate_pitch (wav_fp):
    snd = parselmouth.Sound(wav_fp)
    pitch = snd.to_pitch()
    pitch_values = pitch.selected_array['frequency']
    pitch_values = [pv for pv in pitch_values if pv != 0]
    return np.average(pitch_values)


f0 = 440
a = np.power(2, 1.0/12)
pitch_table = [f0 * np.power((a), n) for n in np.arange(-120, 120)]


def to_nearest_pitch_class (pitch):
    '''
    The basic formula for the frequencies of the notes of the equal tempered scale is given by
    fn = f0 * (a)n
    where
    f0 = the frequency of one fixed note which must be defined. A common choice is setting the A above middle C (A4) at f0 = 440 Hz.
    n = the number of half steps away from the fixed note you are. If you are at a higher note, n is positive. If you are on a lower note, n is negative.
    fn = the frequency of the note n half steps away.
    a = (2)1/12 = the twelth root of 2 = the number which when multiplied by itself 12 times equals 2 = 1.059463094359...

    The wavelength of the sound for the notes is found from
    Wn = c/fn
    where W is the wavelength and c is the speed of sound. The speed of sound depends on temperature, but is approximately 345 m/s at "room temperature."
    '''
    abs_diffs = [abs(p - pitch) for p in pitch_table]
    nearest_pitch = pitch_table[abs_diffs.index(min(abs_diffs))]
    return {
        'nearest_pitch': nearest_pitch,
        'pitch_adjustment': nearest_pitch - pitch, 
    }



if __name__ == '__main__':
    samplerate = 16000

    # load the song from the db
    conn = sqlite3.connect('../server/barker_database.db')
    cur = conn.cursor()

    # show sql if debug
    if args.debug:
        conn.set_trace_callback(print)

    cur.execute('SELECT name, bucket_fp FROM songs where id = :song_id', {
        'song_id': args.song_id,
    })
    song_name, song_fp = cur.fetchone()
    if args.debug:
        print('song name', song_name);

    sequence_count = get_sequence_count(cur, args.user_id, song_name)

    with tempfile.TemporaryDirectory() as tmp_dir:
        # download all crops and convert to wav
        crop_objs = {}
        crop_wavs = {}
        crop_pitches = []
        crop_peaks = []
        for crop in args.crops:
            cur.execute('select bucket_fp, uuid, raw_id from crops where uuid = ?', [crop])
            remote_fp, crop_fk, raw_fk = cur.fetchone()
            crop_aac = os.path.join(tmp_dir, '{}.aac'.format(crop))
            if args.debug:
                print(remote_fp, crop_aac)
            bc.download_filename_from_bucket(remote_fp, crop_aac)
            # convert aac to wav and store the wav fp in the crop dict
            wav_fp = aac_to_wav(crop_aac)
            crop_objs[crop] = {
                'wav': wav_fp
            }
            fname = '/tmp/test.wav'
            with contextlib.closing(wave.open(wav_fp, 'r')) as f:
                frames = f.getnframes()
                rate = f.getframerate()
                duration = frames / float(rate)
            crop_objs[crop]['duration'] = duration
            pitch = estimate_pitch(wav_fp)
            crop_objs[crop]['pitch'] = to_nearest_pitch_class(pitch)
            crop_objs[crop]['peak'] = estimate_peak(wav_fp)

        if args.debug:
            print('CROP OBJS:', crop_objs)


        # TODO different crops need to be in tune!

        # TODO determine crop onset point for things being rhythmically tight
        # for now, just find the peak
        # each crop must have 
        #     - a beat center (where the peak is)
        #     - a nearest pitch class (ignore octave)
        #     - a tuning offset (to get to that pitch class)
        # those attributes should be used to determine final params for rubberband

        

        # find what pitch each crop is closest to (ignore octave)
        # calculate adjustment needed to get other pitches within the 12 tone scale
        # determine root that minimizes shifting

        # download the midi file
        song_local_fp = os.path.join(tmp_dir, 'song.mid')
        bc.download_filename_from_bucket(song_fp, song_local_fp)

        # load the song midi file
        mid = mido.MidiFile(filename=song_local_fp)

        # store rendered audio for each track here
        # in prep for joining together in final sequence
        track_datas = []

        # each track corresponds to a crop
        # TODO handle mismatch in count
        # TODO way to omit non sequence tracks
        for crop, track in zip(args.crops, mid.tracks):
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
            notes = [n for n in notes if n is not None]

            # figure out unique pitch-duration combos
            pitch_durations = list(set([to_pd(note) for note in notes]))
            pitch_durations = [pd for pd in pitch_durations if pd[0] is not None]

            # TODO this will be replaced when handling multi crop tuning
            pitch_midpoint = int(np.average([pd[0] for pd in pitch_durations]))

            # render crops based on needed pitch durations
            crop_map = {}
            for pd in pitch_durations:
                pitch, duration_ticks = pd
                duration = ticks_to_seconds(mid, duration_ticks)
                out_fp = os.path.join(tmp_dir, 'out.wav')
                # need note and crop duration
                rate, audio_data = wavfile.read(crop_objs[crop]['wav'])
                crop_duration = len(audio_data) / rate
                rubberband_args = {
                    'pitch': pitch - pitch_midpoint,
                    'duration': duration / crop_duration, 
                    'crop_fp': crop_objs[crop]['wav'], 
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
            

            # need audio padding for crop offset timing
            audio_padding = samplerate * 2

            # initialize an array with zeros that is the length of the track
            track_sequence = np.zeros((track_samples + audio_padding,))

            # pop audio in by sample index
            for note in notes:
                rest_samples = ticks_to_samples(samplerate, mid, note['time'])
                rest_samples += audio_padding
                audio = crop_map[to_pd(note)]
                # calculate sample offset so peak intesity falls on beat
                peak_time = crop_objs[crop]['peak']['peak_time']
                duration = crop_objs[crop]['duration']
                peak_pct = peak_time / duration
                peak_offset = int(len(audio) * peak_pct)
                # duration influences peak time
                rest_samples -= peak_offset
                print(rest_samples)
                track_sequence[rest_samples:rest_samples + len(audio)] += audio

            track_sequence /= track_sequence.max()
            track_datas.append(track_sequence)

        # combine tracks into single array
        sequence_uuid = uuid.uuid4()
        sequence_fp = os.path.join(tmp_dir, '{}.wav'.format(sequence_uuid))
        sequence_length = max([len(track) for track in track_datas])
        sequence = np.zeros((sequence_length,))
        for track in track_datas:
            sequence[0:len(track)] += track
        sequence /= sequence.max()
        wavfile.write(sequence_fp, samplerate, sequence)
        sequence_fp_aac = wav_to_aac(sequence_fp)


        # name and save to db
        # upload to bucket

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

        if args.debug:
            sp.call('play {}'.format(sequence_fp), shell=True)
            
