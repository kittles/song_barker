import numpy as np
from pyAudioAnalysis import audioSegmentation as audio_seg
from pyAudioAnalysis import audioBasicIO
import tempfile
import scipy.io.wavfile as wavfile
import sqlite3
import uuid
import subprocess as sp
import glob
import warnings
import os


warnings.filterwarnings('ignore')


def all_aac_to_wav ():
    aac_fps = glob.glob('audio_samples/*/*.aac')
    for aac_fp in aac_fps:
        wav_fp = aac_fp.replace('.aac', '.wav')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(aac_fp, wav_fp), shell=True)
        


'''
def silence_removal(signal, sampling_rate, st_win, st_step, smooth_window=0.5,
                    weight=0.5, plot=False):
    """
    Event Detection (silence removal)
    ARGUMENTS:
         - signal:                the input audio signal
         - sampling_rate:               sampling freq
         - st_win, st_step:    window size and step in seconds
         - smoothWindow:     (optinal) smooth window (in seconds)
         - weight:           (optinal) weight factor (0 < weight < 1)
                              the higher, the more strict
         - plot:             (optinal) True if results are to be plotted
    RETURNS:
         - seg_limits:    list of segment limits in seconds (e.g [[0.1, 0.9],
                          [1.4, 3.0]] means that
                          the resulting segments are (0.1 - 0.9) seconds
                          and (1.4, 3.0) seconds
    """
'''
smoothing_window = 0.05
weight = 0.15
crop_count = 0
for wav_fp in glob.glob('audio_samples/*/*.wav'):
    try:
        [fs, x] = audioBasicIO.readAudioFile(wav_fp)
        segments = audio_seg.silenceRemoval(x, fs, 0.025, 0.025, smoothing_window, weight)
        crop_count += len(segments)
        for i, s in enumerate(segments):
            with tempfile.TemporaryDirectory() as tmp_dir:
                out_fp = os.path.join(tmp_dir, 'out.wav')
                wavfile.write(out_fp, fs, x[int(fs * s[0]):int(fs * s[1])])
                sp.call('play {}'.format(out_fp), shell=True)
            
    except:
        #print('error', wav_fp)
        pass
print('{} crops, weight {}'.format(crop_count, weight))
