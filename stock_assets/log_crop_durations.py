import numpy as np
import tempfile
import scipy.io.wavfile as wavfile
import subprocess as sp
import warnings
import glob
import os


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



for fp in glob.glob('barks/*/*.aac'):
    crop_fp = aac_to_wav(fp)
    samplerate, data = wavfile.read(crop_fp)
    print(fp.split('/')[-1], len(data) / samplerate)

