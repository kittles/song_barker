import soundfile as sf
import pyloudnorm as pyln
import subprocess as sp
import warnings
from scipy.io import wavfile
import time
import tempfile
import os
import argparse
import shutil

wav_in_fp = './backing-before-lufs.wav'
wav_out_fp = './backing-after-lufs.wav'

data, rate = sf.read(wav_in_fp) # load audio (with shape (samples, channels))

# normalize the wav (NOTE: peak doesnt compress, but .loudness does)
loudness_normed_audio = pyln.normalize.peak(data, -20.0)

# save normed wav locally
wavfile.write(wav_out_fp, rate, loudness_normed_audio)
