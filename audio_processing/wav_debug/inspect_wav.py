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


crop_fp = 'crop.aac'
crop_fp = aac_to_wav(crop_fp)

def see_mouth_positions (data, rate):
    print(rate, len(data), data.min(), data.max())
    duration = len(data) / rate
    frames = []
    seconds_per_frame = 1 / 60
    time = 0
    while time + seconds_per_frame < duration:
        start_idx = round(time * rate)
        end_idx = round((time + seconds_per_frame) * rate)
        frames.append(sum([
            abs(i) for i in data[start_idx:end_idx]
        ]))
        time += seconds_per_frame
    fmax = max(frames)
    frames = [i / fmax for i in frames]
    for idx, frame in enumerate(frames):
        print(idx, frame)

data, rate = sf.read(crop_fp) # load audio (with shape (samples, channels))
#data = np.array([d[0] for d in data])
see_mouth_positions(data, rate)

#data = pyln.normalize.peak(data, -16.0)
#wavfile.write('peak-normed.wav', rate, data)
#see_mouth_positions(data, rate)
