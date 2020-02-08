import datetime as dt
import numpy as np
from scipy.io.wavfile import read, write
from matplotlib import pyplot as plt
import subprocess as sp
import wave
import glob
from pydub import AudioSegment
import soundfile as sf
import sys
import os
from logger import log
from bucket_client import download_from_bucket, upload_to_bucket
import wave
from io import BytesIO
import argparse

SAMPLERATE = 48000

#SEQUENCE = [
#    (-5, 1),
#    (-5, 1),
#    (-3, 2),
#    (-5, 2),
#    (0, 2),
#    (-1, 4),
#]
#
#
#def to_audio_sequence (audio_fp, in_dir=None, out_fp=None, sequence=SEQUENCE):
#    f = sf.SoundFile(audio_fp)
#    crop_duration = len(f) / f.samplerate
#    # quarter note is .5 seconds, so get the scalar to do that
#    scalar = crop_duration / 0.5
#    c = 1
#    for pitch, duration in sequence:
#        sp.call('rubberband -p {} -t {} {} {}/{:03}.wav'.format(pitch, duration / scalar, audio_fp, in_dir, c), shell=True)
#        c += 1
#
#    infiles = sorted(glob.glob(os.path.join(in_dir, '*.wav')))
#    sounds = [AudioSegment.from_wav(fp) for fp in infiles]
#    combined_sounds = None
#    for sound in sounds:
#        if not combined_sounds:
#            combined_sounds = sound
#        else:
#            combined_sounds = combined_sounds + sound
#    combined_sounds.export(out_fp, format='wav')


# TODO this is just mocked for now so front end can have something to work with

parser = argparse.ArgumentParser()
parser.add_argument('--input', help='the file to be sequenced')
parser.add_argument('--dest', help='where to put the sequenced file')
args = parser.parse_args()

log('start sequence audio {}'.format(args.input))
input_audio = download_from_bucket(args.input)
input_audio.seek(0)
rate, raw = read(BytesIO(input_audio.read()))
raw = np.array(raw)
bytestream = BytesIO()
write(bytestream, SAMPLERATE, raw)
upload_to_bucket(bytestream, args.dest)
log('finish sequence audio {}'.format(args.input))
