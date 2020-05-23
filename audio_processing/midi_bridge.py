import glob
import os
import bucket_client as bc
import mido


def to_pd (note):
    try:
        return note['pitch'], note['duration']
    except:
        return None, None


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
    def __init__ (self, midi_fp, tmp_dir, is_remote=True):
        # download the midi file and load into memory
        self.midi_fp = midi_fp
        if is_remote:
            song_local_fp = os.path.join(tmp_dir, 'song.mid')
            bc.download_filename_from_bucket(midi_fp, song_local_fp)
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


if __name__ == '__main__':
    import tempfile
    with tempfile.TemporaryDirectory() as tmp_dir:
        midi_fp = 'ssb_pitched.mid'
        mb = MidiBridge(midi_fp, tmp_dir, False)
        print(mb.first_note_sample_offset())
        for track in mb.tracks:
            print(track['name'])
            print([mb.ticks_to_seconds(note['time']) for note in track['notes']])

