''' used for pitch shifting and time stretching audio crops
'''
import glob
import os
import tempfile
import warnings
import logger
import parselmouth
import datetime as dt
import audio_conversion as ac
from memoize import memoize
from scipy.io import wavfile
from scipy import signal
from matplotlib import pyplot as plt
import numpy as np
import subprocess as sp


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
    samplerate = 44100

    def __init__ (self, wav_fp, tmp_dir=None):
        self.f0 = 440
        self.a = np.power(2, 1.0/12)
        self.frequency_table = [self.f0 * np.power((self.a), n) for n in np.arange(-120, 120)]
        self.wav_fp = wav_fp
        rate, self.audio_data = wavfile.read(self.wav_fp)
        #if (self.audio_data.dtype != np.int16):
        #    raise Exception('Crop Sampler Data Type Error: got {} but it should be int16'.format(self.audio_data.dtype))
        # handle stereo
        if self.audio_data.ndim == 2:
            self.audio_data = self.audio_data.sum(axis=1) / 2
        # resample
        if rate != self.samplerate:
            log(None, 'rate was {}, resampling to 44100'.format(rate))
            duration = len(self.audio_data) / rate
            self.audio_data = signal.resample(self.audio_data, int(self.samplerate * duration))
            self.audio_data = self.audio_data.astype(np.int16)
        # NOTE audio data should already be mastered before being loaded by crop sampler
        # it should also be a consistent dtype (i think its currently 16bit pcm)
        #print(self.audio_data.astype(np.float32))
        # convert to 32 bit float
        #self.audio_data = self.audio_data.astype(np.float32)
        # normalize
        #self.audio_data = self.audio_data / np.max(self.audio_data)
        # overwrite the file with one at the correct sample rate
        wavfile.write(wav_fp, self.samplerate, self.audio_data)
        self.duration = len(self.audio_data) / self.samplerate
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


    def get_freq (self):
        try:
            # TODO handle bad samples
            snd = parselmouth.Sound(self.wav_fp)
            pitch = snd.to_pitch()
            pitch_values = pitch.selected_array['frequency']
            pitch_values = [pv for pv in pitch_values if pv != 0]
            return np.median(pitch_values)
        except Exception as e:
            log(None, 'get_freq failed with {}'.format(e))


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
    def to_duration (self, duration):
        out_fp = os.path.join(self.tmp_dir, 'out.wav')
        duration = min(duration, self.duration)
        rubberband_args = {
            'duration': duration,
            'crop_fp': self.wav_fp,
            'out_fp': out_fp,
        }
        try:
            sp.call('rubberband -F -D {duration} {crop_fp} {out_fp} > /dev/null 2>&1'.format(
                **rubberband_args
            ), shell=True)
            # TODO handle bad renders
            rate, audio_data = wavfile.read(out_fp)
            # TODO should also return duration and peak info for rendered sample
            return audio_data
        except Exception as e:
            # log error
            log('rubberband failed with {}'.format(e))
            return np.zeros((int(duration * self.samplerate), ))


    @memoize
    def to_relative_pitch_duration (self, pitch, duration):
        out_fp = os.path.join(self.tmp_dir, 'out.wav')
        duration = min(duration, self.duration)
        rubberband_args = {
            'pitch': pitch,
            'duration': duration,
            'crop_fp': self.wav_fp,
            'out_fp': out_fp,
        }
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
            return np.zeros((int(duration * self.samplerate), ))


    @memoize
    def to_pitch_duration (self, pitch, duration):
        out_fp = os.path.join(self.tmp_dir, 'out.wav')
        if self.nearest_pitch is not None:
            pitch_offset = pitch - self.nearest_pitch
        else:
            pitch_offset = 0
        duration = min(duration, self.duration)
        rubberband_args = {
            'pitch': pitch_offset + self.tuning_offset,
            'duration': duration,
            'crop_fp': self.wav_fp,
            'out_fp': out_fp,
        }
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
            return np.zeros((int(duration * self.samplerate), ))


    def play (self, data):
        tmp_fp = os.path.join(self.tmp_dir, 'out.wav')
        wavfile.write(tmp_fp, self.samplerate, data)
        sp.call('play -q {} -t alsa'.format(tmp_fp), shell=True)


    def play_original (self):
        tmp_fp = os.path.join(self.tmp_dir, 'out.wav')
        wavfile.write(tmp_fp, self.samplerate, self.audio_data)
        print(self)
        print('playing original sound...')
        sp.call('play -q {} -t alsa'.format(tmp_fp), shell=True)
        print('done')


    def to_intensity (self):
        snd = parselmouth.Sound(self.wav_fp)
        try:
            return snd.to_intensity()
        except:
            # probably a silent audio
            return None


    def smooth_intensity (self, xs, ys, chunk_size):
        smoothed_xs = []
        smoothed_ys = []
        # slide a chunk_size window across the data
        for idx in range(len(xs - chunk_size)):
            smoothed_xs.append(np.average(xs[idx:idx + chunk_size]))
            smoothed_ys.append(np.average(ys[idx:idx + chunk_size]))
        return smoothed_xs, smoothed_ys


    def normalize_arr (self, arr):
        return arr / max(arr)


    def peak (self):
        ''' returns the percent through the crop that the peak occurs '''
        peak_pct = 0
        intensity = self.to_intensity()
        if intensity is None:
            return peak_pct # just say the beginning of the clip is the peak
        xs = intensity.xs()
        ys = intensity.values[0]
        smooth_xs, smooth_ys = self.smooth_intensity(xs, ys, 10)
        smooth_ys /= max(smooth_ys)
        for x, y in zip(smooth_xs, smooth_ys):
            if y > 0.7:
                peak_pct = x / self.duration
                break
        return peak_pct


    def plot_audio (self, save=False):
        plt.clf()
        plt.plot(self.audio_data)
        intensity = self.to_intensity()
        if intensity is None:
            return
        xs = intensity.xs()
        ys = intensity.values[0]
        smooth_xs, smooth_ys = self.smooth_intensity(xs, ys, 10)
        # transform intensity to sample space
        smooth_xs = self.normalize_arr(smooth_xs) * len(self.audio_data)
        smooth_ys = self.normalize_arr(smooth_ys)


        #plt.plot(xs, ys)
        plt.plot(smooth_xs, smooth_ys)
        plt.axvline(self.peak() * len(self.audio_data), color='red')
        if save:
            plt.savefig(save)
        else:
            plt.show()


    def __repr__ (self):
        return repr_string.format(
            self.wav_fp.split('/')[-1],
            self.samplerate,
            self.duration,
            self.peak(),
            self.original_hz,
            self.nearest_hz,
            self.nearest_pitch
        )


if __name__ == '__main__':
    import shutil
    import uuid
    with tempfile.TemporaryDirectory() as tmp_dir:
        #for fp in glob.glob('./fixture_assets/crops/*.aac'):
        #    try:
        #        tmp_fp = os.path.join(tmp_dir, '{}.aac'.format(uuid.uuid4()))
        #        shutil.copyfile(fp, tmp_fp)
        #        fp = ac.aac_to_wav(tmp_fp)
        #        cs = CropSampler(fp, tmp_dir)
        #        print(cs)
        #        start = dt.datetime.now()
        #        data = cs.to_pitch_duration(cs.nearest_pitch + 2, cs.duration())
        #        print('data len', len(data))
        #        cs.play(data)
        #        data = cs.to_duration(cs.duration() / 2)
        #        print('data len', len(data))
        #        cs.play(data)
        #        #print('took {} s'.format(dt.datetime.now() - start))
        #    except Exception as e:
        #        print('\n*** \n\n !!!! FAILED {} \n\n***'.format(fp))
        #        print(e)
        #for fp in glob.glob('./fixture_assets/crops/*.aac'):
        #    #fp = './fixture_assets/crops/three.aac'
        #    fname = fp.split('/')[-1].replace('.aac', '')
        #    print(fname)
        #    tmp_fp = os.path.join(tmp_dir, '{}.aac'.format(uuid.uuid4()))
        #    shutil.copyfile(fp, tmp_fp)
        #    fp = ac.aac_to_wav(tmp_fp)
        #    cs = CropSampler(fp, tmp_dir)
        #    print(cs.peak(), len(cs.audio_data), cs.peak() * len(cs.audio_data))
        #    #cs.plot_audio('./plots/' + fname + '.png')
        ##cs.play_original()
        ##print(cs.nearest_concert_freq())
        fp = './error-crop.aac'
        fname = fp.split('/')[-1].replace('.aac', '')
        print(fname)
        tmp_fp = os.path.join(tmp_dir, '{}.aac'.format(uuid.uuid4()))
        shutil.copyfile(fp, tmp_fp)
        fp = ac.aac_to_wav(tmp_fp)
        cs = CropSampler(fp, tmp_dir)
        print(cs.audio_data.shape)
        print(cs.peak(), len(cs.audio_data), cs.peak() * len(cs.audio_data))
        cs.play_original()
        data = cs.to_pitch_duration(cs.nearest_pitch + 2, cs.duration)
        print('data len', len(data))
        cs.play(data)
        #cs.plot_audio('./plots/' + fname + '.png')
