'''
some convenience functions to convert audio formats using ffmpeg
'''
import subprocess as sp
import warnings
import os
import shutil
from scipy.io import wavfile


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


AAC_OFFSET_MS = 23

def wav_to_aac_no_offset (wav_fp):
    # reencoding wav as aac adds about .023 seconds, which is not a bug
    # because of aac spec, apparently
    with warnings.catch_warnings():
        # trim 0.023 seconds off the wav, so that aac
        # encoded version winds up at the original spot
        # NOTE: you need to have at least 0.023s of silence at the beginning
        # otherwise that will get lost
        tmp_wav_fp = wav_fp.replace('.wav', '-temp.wav')
        rate, data = wavfile.read(wav_fp)
        samples_to_cut = int(AAC_OFFSET_MS * (rate / 1000))
        wavfile.write(tmp_wav_fp, rate, data[samples_to_cut:])

        # convert the shifted temporary wav file to aac
        aac_fp = wav_fp.replace('.wav', '.aac')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic -y -i {} {}'.format(tmp_wav_fp, aac_fp), shell=True)
        os.remove(tmp_wav_fp)
    return aac_fp


if __name__ == '__main__':
    #aac_to_wav('~/Desktop/test-convert/original-backing.aac')
    wav_to_aac_no_offset('/home/patrick/Desktop/test-convert/original-backing-for-reencoding.wav')




