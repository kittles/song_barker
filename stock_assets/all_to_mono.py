import numpy as np
import tempfile
import scipy.io.wavfile as wavfile
import subprocess as sp
import warnings
import glob
import os



for fp in glob.glob('barks/*/*.aac'):
    #sp.call('ffprobe {} 2>&1 | grep "Stream #0:0"'.format(fp), shell=True)
    if fp.find('-mono.aac') > 0:
        continue
    temp_mono_fp = fp.replace('.aac', '-mono.aac')
    ##sp.call('ffmpeg -i "{}" -ac 1 "{}" -y'.format(fp, temp_mono_fp), shell=True)
    sp.call('mv "{}" "{}"'.format(temp_mono_fp, fp), shell=True)


