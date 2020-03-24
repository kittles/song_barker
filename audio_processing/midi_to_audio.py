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


warnings.filterwarnings('ignore')
log = logger.log_fn(os.path.basename(__file__)) 


parser = argparse.ArgumentParser()
#parser.add_argument('--midi-file', '-m', help='midi file')
parser.add_argument('--user-id', '-u', help='the user id', type=str)
parser.add_argument('--song-id', '-s', help='the song id', type=str, default=1)
parser.add_argument('--crops', '-c', nargs='+', help='crops used for each instrument, in track order')
parser.add_argument('--debug', '-d', action='store_true', help='playback audio crops', default=False)
args = parser.parse_args()


class memoize (object):
    '''cache the return value of a method

    This class is meant to be used as a decorator of methods. The return value
    from a given method invocation will be cached on the instance whose method
    was invoked. All arguments passed to a method decorated with memoize must
    be hashable.

    If a memoized method is invoked directly on its class the result will not
    be cached. Instead the method will be invoked like a static method:
    class Obj(object):
        @memoize
        def add_to(self, arg):
            return self + arg
    Obj.add_to(1) # not enough arguments
    Obj.add_to(1, 2) # returns 3, result is not cached
    '''
    def __init__(self, func):
        self.func = func
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self.func
        return partial(self, obj)
    def __call__(self, *args, **kw):
        obj = args[0]
        try:
            cache = obj.__cache
        except AttributeError:
            cache = obj.__cache = {}
        key = (self.func, args[1:], frozenset(kw.items()))
        try:
            res = cache[key]
        except KeyError:
            res = cache[key] = self.func(*args, **kw)
        return res


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
    from: https://pages.mtu.edu/~suits/NoteFreqCalcs.html
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

    from: https://www.johndcook.com/blog/2013/06/22/how-to-convert-frequency-to-pitch/
        I saw somewhere that James Earl Jones’ speaking voice is around 85 Hz. What musical pitch is that?
        Let P be the frequency of some pitch you’re interested in and let C = 261.626 be the frequency of middle C. If h is the number of half steps from C to P then
        P / C = 2**h/12.
        Taking logs,
        h = 12 log(P / C) / log 2.
        If P = 85, then h = -19.46. That is, James Earl Jones’ voice is about 19 half-steps below middle C, around the F an octave and a half below middle C.
    '''
    abs_diffs = [abs(p - pitch) for p in pitch_table]
    nearest_pitch = pitch_table[abs_diffs.index(min(abs_diffs))]
    # get half steps away
    half_steps = 12 * np.log(nearest_pitch / pitch) / np.log(2)
    half_steps_from_a440 = 12 * np.log(nearest_pitch / f0) / np.log(2)

    return {
        'nearest_pitch': nearest_pitch,
        'pitchclass': (69 + half_steps_from_a440) % 12, # a440 is 69
        'pitch_adjustment': nearest_pitch - pitch, 
        'half_steps': half_steps,
    }
    # how to take a Hz difference and turn it in to a half-steps difference


class Crop (object):
    f0 = 440
    a = np.power(2, 1.0/12)
    frequency_table = [f0 * np.power((a), n) for n in np.arange(-120, 120)]


    def __init__ (self, wav_fp):
        self.wav_fp = wav_fp
        rate, audio_data = wavfile.read(self.wav_fp)
        self.rate = rate
        self.audio_data = audio_data
        self.pitch_durations = {}
        self.original_hz = self.get_freq()
        self.nearest_hz = self.nearest_concert_freq()
        self.nearest_pitch = self.freq_to_midi_number(self.nearest_hz)
        self.tuning_offset = self.steps_between_freqs(self.original_hz, self.nearest_hz)
        self._memo = {}


    def duration (self):
        # seconds
        with contextlib.closing(wave.open(self.wav_fp, 'r')) as f:
            frames = f.getnframes()
            rate = f.getframerate()
            return frames / float(rate)


    @memoize
    def peak (self):
        # seconds
        snd = parselmouth.Sound(self.wav_fp)
        intensity = snd.to_intensity()
        xs = intensity.xs()
        ivs = intensity.values[0]
        chunks = [np.sum(ivs[i:i+3]) for i in range(len(ivs) - 5)]
        peak = np.max(chunks)
        peak_idx = chunks.index(peak)
        return xs[peak_idx]


    def get_freq (self):
        snd = parselmouth.Sound(self.wav_fp)
        pitch = snd.to_pitch()
        pitch_values = pitch.selected_array['frequency']
        pitch_values = [pv for pv in pitch_values if pv != 0]
        return np.median(pitch_values)


    def steps_between_freqs (self, f1, f2):
        half_steps = 12 * np.log(f2 / f1) / np.log(2)
        return half_steps


    def nearest_concert_freq (self):
        freq = self.get_freq()
        abs_diffs = [abs(concert_freq - freq) for concert_freq in self.frequency_table]
        nearest_freq = self.frequency_table[abs_diffs.index(min(abs_diffs))]
        return nearest_freq


    def freq_to_midi_number (self, freq):
        half_steps_from_a440 = 12 * np.log(freq / f0) / np.log(2)
        return round(69 + half_steps_from_a440) # a440 is midi pitch 69


    def to_pitchclass (self, pitch):
        return pitch % 12

    def pd_key (self, pitch, duration):
        return '{}-{}'.format(pitch, duration)


    @memoize
    def to_pitch_duration (self, pitch, duration):
        key = self.pd_key(pitch, duration)
        if self._memo.get(key, None) is not None:
            return self._memo[key]
        out_fp = os.path.join(tmp_dir, 'out.wav')
        nearest_pitch = self.freq_to_midi_number(self.nearest_hz)
        pitch_offset = pitch - nearest_pitch
        
        while pitch_offset < -24:
            pitch_offset += 12
        while pitch_offset > 24:
            pitch_offset -= 12

        #if pitch_offset < 0:
        #    pitch_offset += 1

        rubberband_args = {
            'pitch': pitch_offset + self.tuning_offset,
            'duration': duration / self.duration(), 
            'crop_fp': self.wav_fp,
            'out_fp': out_fp,
        }
        sp.call('rubberband -p {pitch} -t {duration} {crop_fp} {out_fp} > /dev/null 2>&1'.format(
            **rubberband_args
        ), shell=True)
        rate, audio_data = wavfile.read(out_fp)
        return audio_data


    def play (self, data):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_fp = os.path.join(tmp_dir, 'out.wav')
            wavfile.write(tmp_fp, self.rate, data)
            sp.call('play -q {}'.format(tmp_fp), shell=True)


    def __repr__ (self):
        return '<Crop Object - freq: {} nearest_freq: {} nearest_pitch: {}>'.format(
            self.original_hz,
            self.nearest_hz,
            self.nearest_pitch
        )


if __name__ == '__main__':
    log(' '.join(args.crops), 'started')
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

        # instantiate crop objects
        crop_objs = []
        for crop in args.crops:
            cur.execute('select bucket_fp, uuid, raw_id from crops where uuid = ?', [crop])
            remote_fp, crop_fk, raw_fk = cur.fetchone()
            crop_aac = os.path.join(tmp_dir, '{}.aac'.format(crop))
            if args.debug:
                print(remote_fp, crop_aac)
            bc.download_filename_from_bucket(remote_fp, crop_aac)
            # convert aac to wav and store the wav fp in the crop dict
            wav_fp = aac_to_wav(crop_aac)
            crop = Crop(wav_fp)
            crop_objs.append(crop)

        # download the midi file
        song_local_fp = os.path.join(tmp_dir, 'song.mid')
        bc.download_filename_from_bucket(song_fp, song_local_fp)

        # load the song midi file
        mid = mido.MidiFile(filename=song_local_fp)

        # store rendered audio for each track here
        # in prep for joining together in final sequence
        track_notes = []
        for crop, track in zip(crop_objs, mid.tracks):
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

            notes = [n for n in notes if n is not None]
            pitch_durations = list(set([to_pd(note) for note in notes]))
            track_notes.append(notes)
            #crop_obj.notes = notes
            #pitch_durations = [pd for pd in pitch_durations if pd[0] is not None]
            #pitch_midpoint = int(np.average([pd[0] for pd in pitch_durations]))

        track_sequences = []
        for crop, track in zip(crop_objs, track_notes):
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
            for note in track:
                audio_data = crop.to_pitch_duration(note['pitch'], ticks_to_seconds(mid, note['duration']))
                rest_samples = ticks_to_samples(samplerate, mid, note['time'])
                rest_samples += audio_padding
                # calculate sample offset so peak intesity falls on beat
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
        start_idx = 0
        for s in sequence:
            start_idx += 1
            if s > 0:
                break
        sequence = sequence[start_idx:]

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
        conn.commit()

        if args.debug:
            for crop in crop_objs:
                print(crop)
            sp.call('play {}'.format(sequence_fp), shell=True)

        print(sequence_uuid, remote_sequence_url)
        log(' '.join(args.crops), 'finished')
           
