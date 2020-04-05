from memoize import memoize
import glob
import datetime as dt
import os
from scipy.io import wavfile
import numpy as np
import tempfile
import subprocess as sp
import warnings
import parselmouth
import wave
import contextlib
import logger


warnings.filterwarnings('ignore')
log = logger.log_fn(os.path.basename(__file__)) 


repr_string = '''
<Crop Object> 
    - file: {}
    - samplerate: {}
    - duration: {:.2f} 
    - peak: {:.2f}
    - freq: {:.2f} 
    - nearest_freq: {:.2f}
    - nearest_pitch: {}
</Crop Object>
'''


class CropSampler (object):


    def __init__ (self, wav_fp, tmp_dir=None):
        self.f0 = 440
        self.a = np.power(2, 1.0/12)
        self.frequency_table = [self.f0 * np.power((self.a), n) for n in np.arange(-120, 120)]
        self.wav_fp = wav_fp
        rate, audio_data = wavfile.read(self.wav_fp)
        self.rate = rate
        self.audio_data = audio_data
        self.pitch_durations = {}
        self.original_hz = self.get_freq()
        self.nearest_hz = self.nearest_concert_freq()
        self.nearest_pitch = self.freq_to_midi_number(self.nearest_hz)
        if self.nearest_pitch is None or self.nearest_pitch < 12 or self.nearest_pitch > 120:
            self.nearest_pitch = None
            self.tuning_offset = 0
        else:
            self.tuning_offset = self.steps_between_freqs(self.original_hz, self.nearest_hz)
        # TODO check to see how long these things stick around...
        self.tmp_dir = tmp_dir


    @memoize
    def samplerate (self):
        # TODO handle bad samples
        # seconds
        with contextlib.closing(wave.open(self.wav_fp, 'r')) as f:
            return f.getframerate()


    @memoize
    def duration (self):
        # TODO handle bad samples
        # seconds
        with contextlib.closing(wave.open(self.wav_fp, 'r')) as f:
            frames = f.getnframes()
            rate = f.getframerate()
            return frames / float(rate)


    @memoize
    def peak (self):
        # TODO handle bad samples
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
        # TODO handle bad samples
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
        half_steps_from_a440 = 12 * np.log(freq / self.f0) / np.log(2)
        return int(round(69 + half_steps_from_a440)) # a440 is midi pitch 69


    def to_pitchclass (self, pitch):
        return pitch % 12


    def pd_key (self, pitch, duration):
        return '{}-{}'.format(pitch, duration)


    @memoize
    def to_pitch_duration (self, pitch, duration):
        out_fp = os.path.join(self.tmp_dir, 'out.wav')
        if self.nearest_pitch is not None:
            pitch_offset = pitch - self.nearest_pitch
        else:
            pitch_offset = 0
        duration = min(duration, self.duration())
        
        ## TODO this needs to be smarter
        #while pitch_offset < -10:
        #    pitch_offset += 12
        #while pitch_offset > 12:
        #    pitch_offset -= 12

        rubberband_args = {
            'pitch': pitch_offset + self.tuning_offset,
            'duration': duration,
            'crop_fp': self.wav_fp,
            'out_fp': out_fp,
        }

        # NOTE using pitch <= 12 as stand in for "dont change the pitch of the crop"
        if pitch is None or pitch <= 12 :
            rubberband_args['pitch'] = 0

        try:
            sp.call('rubberband -F -p {pitch} -D {duration} {crop_fp} {out_fp} > /dev/null 2>&1'.format(
                **rubberband_args
            ), shell=True)
            # TODO handle bad renders
            rate, audio_data = wavfile.read(out_fp)
            # TODO should also return duration and peak info for rendered sample
            return audio_data
        except Exception as e:
            # log error
            log('rubberband failed with {}'.format(e))
            return np.zeros((int(duration * self.samplerate()), ))


    def play (self, data):
        tmp_fp = os.path.join(self.tmp_dir, 'out.wav')
        wavfile.write(tmp_fp, self.rate, data)
        sp.call('play -q {} -t alsa'.format(tmp_fp), shell=True)


    def play_original (self):
        tmp_fp = os.path.join(self.tmp_dir, 'out.wav')
        wavfile.write(tmp_fp, self.rate, self.audio_data)
        print(self)
        print('playing original sound...')
        sp.call('play -q {} -t alsa'.format(tmp_fp), shell=True)
        print('done')


    def __repr__ (self):
        return repr_string.format(
            self.wav_fp.split('/')[-1],
            self.samplerate(),
            self.duration(),
            self.peak(),
            self.original_hz,
            self.nearest_hz,
            self.nearest_pitch
        )


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as tmp_dir:
        for fp in glob.glob('./crop_fixtures/*.wav'):
            try:
                cs = CropSampler(fp, tmp_dir)
                print(cs)
                start = dt.datetime.now()
                data = cs.to_pitch_duration(cs.nearest_pitch, cs.duration())
                print('data len', len(data))
                #cs.play(data)
                #print('took {} s'.format(dt.datetime.now() - start))
            except Exception as e:
                print('\n*** \n\n !!!! FAILED {} \n\n***'.format(fp))
                print(e)
