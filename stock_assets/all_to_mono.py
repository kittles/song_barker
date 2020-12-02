import numpy as np
import tempfile
import scipy.io.wavfile as wavfile
import subprocess as sp
import warnings
import glob
import os



def all_to_mono ():
    for fp in glob.glob('barks/*/*.aac'):
        #sp.call('ffprobe {} 2>&1 | grep "Stream #0:0"'.format(fp), shell=True)
        if fp.find('-mono.aac') > 0:
            continue
        temp_mono_fp = fp.replace('.aac', '-mono.aac')
        sp.call('ffmpeg -i "{}" -ar 44100 -ac 1 "{}" -y'.format(fp, temp_mono_fp), shell=True)
        sp.call('mv "{}" "{}"'.format(temp_mono_fp, fp), shell=True)




def check_bark_dtype ():
    for fp in glob.glob('barks/*/*.aac'):
        sp.call('ffprobe {} 2>&1 | grep "Stream #0:0"'.format(fp), shell=True)
        #sp.call('ffmpeg -i {}'.format(fp), shell=True)



if __name__ == '__main__':
    #all_to_mono()
    check_bark_dtype()
