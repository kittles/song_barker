import glob
import os
import bucket_client as bc
import mido
from collections import defaultdict


def to_pd (note):
    try:
        return note['pitch'], note['duration']
    except:
        return None, None


def midi_message_to_dict ():
    '''
    turns midi events into note dictionaries with intuitive
    duration and time

    when on events with the same pitch happen before an off event,
    assume that the first off event corresponds to the first on event
    '''
    _notes = defaultdict(list) # keep track of events in here as we iterate through them
    _time = 0 # time of events is relative to last event, so increment here
    note_on_count = 0

    def handle_message (msg):
        nonlocal _notes
        nonlocal _time
        nonlocal note_on_count
        _time += msg.time
        #print('\n-- start handle message --')
        #print(msg)
        #print(max([0] + [len(_notes[i]) for i in _notes]))
        try:
            if msg.type == 'note_on':
                note_on_count += 1
                #print('note on count', note_on_count)
                _notes[msg.note].append({
                    'pitch': msg.note,
                    'velocity': msg.velocity,
                    'time': _time,
                    'duration': 0,
                })
            if msg.type == 'note_off':
                note_arr = _notes[msg.note]
                #print('note_arr len before', len(note_arr))
                if len(note_arr) < 1:
                    # must be a phantom off event, just let it pass
                    pass
                note = note_arr.pop(0) # take the earliest on event
                note['duration'] = _time - note['time']
                #print('note_arr len after', len(note_arr))
                #print('-- end handle message --\n')
                return note
            #print('-- end handle message --\n')
        except Exception as e:
            #print('error', e)
            #print(msg, _notes)
            # TODO log
            pass

    return handle_message


def check_marker (marker, name):
    return name[:len(marker)] == marker


class MidiBridge (object):
    '''
    takes midi files and prepares them for use with sequencing
    '''
    def __init__ (self, midi_fp, tmp_dir, bucket_name, is_remote=True):
        # download the midi file and load into memory
        self.midi_fp = midi_fp
        if is_remote:
            song_local_fp = os.path.join(tmp_dir, 'song.mid')
            bc.download_file_from_bucket(midi_fp, song_local_fp, bucket_name)
            self.midi_file = mido.MidiFile(filename=song_local_fp)
        else:
            self.midi_file = mido.MidiFile(filename=midi_fp)

        # get the tempo
        # midi tempo is microseconds per beat
        self.tempo = None
        for track in self.midi_file.tracks:
            for msg in track:
                if msg.type == 'set_tempo':
                    self.tempo = msg.tempo
                    break
            if self.tempo is not None:
                break
        if self.tempo is None:
            self.tempo = 500000
        self.bpm = (60 * 1e6) / self.tempo
        # The formula is 60000 / (BPM * PPQ) (milliseconds).
        # Where BPM is the tempo of the track (Beats Per Minute).
        # (i.e. a 120 BPM track would have a MIDI time of (60000 / (120 * 192)) or 2.604 ms for 1 tick.
        self.tick_duration_ms = (60000 / (self.bpm * self.midi_file.ticks_per_beat)) # in milliseconds

        # turn midi events into note dicts for ease of use
        # TODO make this create track objects
        # include notes, name, track type (melody, unpitched)
        self.tracks = []
        for track in self.midi_file.tracks:
            tdict = {
                'notes': None,
                'name': track.name,
                'nopitch': check_marker('nopitch_', track.name),
                'relativepitch': check_marker('relativepitch_', track.name),
            }
            msg_to_dict = midi_message_to_dict()
            notes = []
            # parse into convenient format
            for msg in track:
                if msg.type == 'note_on':
                    msg_to_dict(msg)
                elif msg.type == 'note_off':
                    note = msg_to_dict(msg)
                    notes.append(note)
                else:
                    msg_to_dict(msg)

            notes = [n for n in notes if n is not None]
            pitch_durations = list(set([to_pd(note) for note in notes]))
            if len(notes) > 0:
                tdict['notes'] = notes
                self.tracks.append(tdict)

        # set the first track that isnt noptiched to melody
        self.melody_track = None
        for track in self.tracks:
            if not track['nopitch']:
                self.melody_track = track
                break


    def melody_range (self):
        pitches = [note['pitch'] for note in self.melody_track['notes']]
        return min(pitches), max(pitches)


    def track_count (self):
        return len(self.tracks)


    def ticks_to_samples (self, ticks, samplerate):
        return int(samplerate * (ticks * self.tick_duration_ms) / 1000)


    def ticks_to_seconds (self, ticks):
        return (ticks * self.tick_duration_ms) / 1000


    def total_ticks (self):
        return max([
            max([
                note['duration'] + note['time'] for note in track['notes']
            ])
            for track in self.tracks
        ])


    def total_samples (self, samplerate):
        # return total number of samples midi track would be at samplerate
        return int(self.ticks_to_seconds(self.total_ticks()) * samplerate)


    def first_note_sample_offset (self):
        mins = []
        for track in self.tracks:
            mins.append(min([note['time'] for note in track['notes']]))
        return self.ticks_to_samples(min(mins), 44100)


    def visualize (self):
        from matplotlib import pyplot as plt
        for track in self.tracks:
            xs, ys = [], []
            for note in track['notes']:
                xs.append(note['time'])
                ys.append(note['pitch'])
            plt.scatter(xs, ys)
        plt.show()



if __name__ == '__main__':
    #import tempfile
    #with tempfile.TemporaryDirectory() as tmp_dir:
    #    midi_fp = '../songs/old_macdonald_harmonized/song.mid'
    #    mb = MidiBridge(midi_fp, tmp_dir, False)
    #    print('BPM:', mb.bpm)
    #    mb.visualize()
    #for track in mb.tracks:
    #    for idx, note in enumerate(track['notes']):
    #        print(idx, note)
    print('not implemented yet')
