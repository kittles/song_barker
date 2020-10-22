import glob
import subprocess as sp
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
dir_path = os.path.dirname(os.path.realpath(__file__))
tmp_audio_dir = os.path.join(dir_path, 'tmp_audio')


def aac_to_wav (aac_fp, wav_fp):
    with warnings.catch_warnings():
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic -y -i "{}" "{}"'.format(aac_fp, wav_fp), shell=True)
    return wav_fp


def wav_to_aac (wav_fp, aac_fp):
    with warnings.catch_warnings():
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic -y -i "{}" "{}"'.format(wav_fp, aac_fp), shell=True)
    return aac_fp

def normalize_all_songs ():
    peak = '-32.0'
    for fp in glob.glob('../../songs/*/*.aac'):
        cmd = 'python to_normalized_loudness.py -i "{}" -p "{}"'.format(fp, peak)
        print(cmd)
        sp.call(cmd, shell=True)


def normalize_all_barks ():
    peak = '-20.0'
    for fp in glob.glob('../../stock_assets/barks/*/*.aac'):
        cmd = 'python to_normalized_loudness.py -i "{}" -p "{}"'.format(fp, peak)
        print(cmd)
        sp.call(cmd, shell=True)


def check_all_barks ():
    for fp in glob.glob('../../stock_assets/barks/*/*.aac'):
        sp.call('cvlc --no-repeat --no-loop --play-and-exit "{}"'.format(fp), shell=True)
        input()


def check_all_songs ():
    for fp in glob.glob('../../songs/*/*.aac'):
        sp.call('cvlc --no-repeat --no-loop --play-and-exit --run-time=3 "{}"'.format(fp), shell=True)
        input()


def get_loudness (fp):
    aac_in_fp = fp

    wav_in_fp = os.path.join(tmp_audio_dir, 'wav_in.wav')

    # convert the original audio to temp wav
    aac_to_wav(aac_in_fp, wav_in_fp)

    data, rate = sf.read(wav_in_fp) # load audio (with shape (samples, channels))

    block_size = min(0.5, (len(data) / rate)/2)
    meter = pyln.Meter(rate, block_size=block_size) # create BS.1770 meter

    # normalize peak
    #data = pyln.normalize.peak(data, args.peak)
    loudness = meter.integrated_loudness(data) # measure loudness
    os.remove(wav_in_fp)
    return loudness


def check_all_barks_LUFS ():
    for fp in glob.glob('../../stock_assets/barks/*/*.aac'):
        print('{} loudness: {}'.format(fp, get_loudness(fp)))


def check_all_songs_LUFS ():
    for fp in glob.glob('../../songs/*/*.aac'):
        print('{} loudness: {}'.format(fp, get_loudness(fp)))

if __name__ == '__main__':
    #normalize_all_songs()
    #normalize_all_barks()
    check_all_barks()
    #check_all_songs_LUFS()
    #check_all_barks_LUFS()
