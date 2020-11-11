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


for fp in glob.glob('../../songs/*/*.aac'):
    print(fp)
    # convert an aac to wav locally temp
    aac_in_fp = fp
    wav_in_fp = os.path.join(tmp_audio_dir, 'wav_in.wav')
    wav_out_fp = os.path.join(tmp_audio_dir, 'wav_out.wav')
    aac_out_fp = os.path.join(tmp_audio_dir, 'aac_out.aac')

    # convert the original audio to temp wav
    aac_to_wav(aac_in_fp, wav_in_fp)

    # bump the volume with ffmpeg
    cmd = 'ffmpeg -i "{}" -filter:a "volume=1.3" "{}"'.format(
        wav_in_fp,
        wav_out_fp,
    )
    sp.call(cmd, shell=True)

    # convert local wav to local aac
    wav_to_aac(wav_out_fp, aac_out_fp)

    # replace original aac with local aac
    if os.path.exists(aac_out_fp):
        print('replacing old aac with new normed one')
        shutil.copy(aac_out_fp, aac_in_fp)

        # clean up
        os.remove(wav_in_fp)
        os.remove(wav_out_fp)
        os.remove(aac_out_fp)

        #data, rate = sf.read(wav_out_fp) # load audio (with shape (samples, channels))
        #meter = pyln.Meter(rate) # create BS.1770 meter
        #loudness = meter.integrated_loudness(data) # measure loudness
        #print('loudness is now', loudness)
    else:
        print('failed for ', aac_out_fp)
