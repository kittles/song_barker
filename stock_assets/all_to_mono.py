import numpy as np
import tempfile
import scipy.io.wavfile as wavfile
import subprocess as sp
import warnings
import glob
import os



for fp in glob.glob('barks/*/*.aac'):
    sp.call('ffprobe {} 2>&1 | grep "Stream #0:0"'.format(fp), shell=True)
    sp.call('ffmpeg -i {} -ac 1 {}"'.format(fp), shell=True)


