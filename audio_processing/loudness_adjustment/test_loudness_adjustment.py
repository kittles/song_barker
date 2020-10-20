import soundfile as sf
import pyloudnorm as pyln
import subprocess as sp
import warnings
from scipy.io import wavfile
import time
import numpy as np


def aac_to_wav (aac_fp):
    with warnings.catch_warnings():
        wav_fp = aac_fp.replace('.aac', '.wav')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic -y -i {} {}'.format(aac_fp, wav_fp), shell=True)
    return wav_fp


def wav_to_aac (wav_fp):
    with warnings.catch_warnings():
        aac_fp = wav_fp.replace('.wav', '.aac')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic -y -i {} {}'.format(wav_fp, aac_fp), shell=True)
    return aac_fp


def play_audio (audio_fp):
    sp.call('play {}'.format(audio_fp), shell=True)


start = time.perf_counter()
crop_fp_aac = 'A.aac'
crop_fp = aac_to_wav(crop_fp_aac)
#crop_fp = 'test_dynamic.wav'
data, rate = sf.read(crop_fp) # load audio (with shape (samples, channels))

duration = len(data) / rate
for i in np.linspace(0.01, duration, 5):
    start = time.perf_counter()
    meter = pyln.Meter(rate, block_size=i) # create BS.1770 meter
    loudness = meter.integrated_loudness(data) # measure loudness
    print(i, loudness)
    loudness_normed_audio = pyln.normalize.loudness(data, loudness, -32.0)
    wavfile.write('{}-{}'.format(i, crop_fp), rate, loudness_normed_audio)
#play_audio(crop_fp)

# normalize peak
#data = pyln.normalize.peak(data, -12.0)

# play lufs adjusted sound
#loudness = meter.integrated_loudness(data) # measure loudness
#loudness_normed_audio = pyln.normalize.loudness(data, loudness, -16.0)
##print('normed loudness', meter.integrated_loudness(loudness_normed_audio))
#wavfile.write('./output.wav', 44100, loudness_normed_audio)
#print(time.perf_counter() - start)
#play_audio('./output.wav')
