import collections as cl
import mido
import argparse
import uuid
import os
from scipy.io import wavfile
import numpy as np
import tempfile
import subprocess as sp
'''
this should take a midi file and a set of crops
    -m midifile.mid -c crop1.wav crop2.wav ...
and generate an audio file that uses the crops as instruments
'''
parser = argparse.ArgumentParser()
parser.add_argument('--midi-file', '-m', help='midi file')
parser.add_argument('--crops', '-c', nargs='+', help='crops used for each instrument, in track order')
parser.add_argument('--debug', '-d', action='store_true', help='playback audio crops', default=False)
args = parser.parse_args()


def handler ():
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

    with tempfile.TemporaryDirectory() as tmp_dir:
        #TODO different crops need to be in tune!

        print(os.path.exists(tmp_dir))

        mid = mido.MidiFile(filename=args.midi_file)

        for i, track in enumerate(mid.tracks):
            crop = args.crops[i]
            handle_message = handler()
            msgs = [msg for msg in track if msg.type in ['note_on', 'note_off']]
            notes = []
            # parse into convenient format
            for msg in msgs:
                if msg.type == 'note_on':
                    handle_message(msg)
                if msg.type == 'note_off':
                    note = handle_message(msg)
                    notes.append(note)

            if len(notes) < 2:
                continue

            # figure out unique pitch-duration combos
            pitch_durations = [(note['pitch'], note['duration']) for note in notes]
            list(set(pitch_durations))

            pitch_midpoint = int(np.average([pd[0] for pd in pitch_durations]))

            # render crops based on needed pitch durations
            crop_map = {}
            for pd in pitch_durations:
                pitch = pd[0]
                duration = ticks_to_seconds(mid, pd[1])
                crop_fp = args.crops[i]
                out_fp = os.path.join(tmp_dir, 'out.wav')
                # need note and crop duration
                rate, data = wavfile.read(crop_fp)
                crop_duration = len(data) / rate
                rubberband_args = {
                    'pitch': pitch - pitch_midpoint,
                    'duration': duration / crop_duration, 
                    'crop_fp': crop_fp, 
                    'out_fp': out_fp,
                }
                sp.call('rubberband -q -p {pitch} -t {duration} {crop_fp} {out_fp}'.format(
                    **rubberband_args
                ), shell=True)
                rate, data = wavfile.read(out_fp)
                # should read crops in numpy arrays
                crop_map[pd] = data

            # stitch renders together based on track events
            # generate necessary length zero array based on sample rate
            # add renders and the right spots
            # need time to sample_idx ()
            track_ticks = max([note['duration'] + note['time'] for note in notes])
            track_seconds = ticks_to_seconds(mid, track_ticks)
            track_samples = int(track_seconds * samplerate) + 1
            

            sequence = np.zeros((track_samples,))
            for note in notes:
                rest_samples = ticks_to_samples(samplerate, mid, note['time'])
                audio = crop_map[to_pd(note)]
                sequence[rest_samples:rest_samples + len(audio)] += audio

            sequence /= sequence.max()
            wavfile.write('sequence.wav', samplerate, sequence)


            

