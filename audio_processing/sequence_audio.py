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
import bucket_client
import tempfile
import os
from logger import log
from bucket_client import download_from_bucket, upload_to_bucket
import wave
import argparse
from pydub import AudioSegment

SAMPLERATE = 48000
BPM = 120

SEQUENCE = [(i[0], i[1]/(BPM/60)) for i in [
    (-5, 1),
    (-5, 1),
    (-3, 2),
    (-5, 2),
    (0, 2),
    (-1, 4),
]]

parser = argparse.ArgumentParser()
parser.add_argument('--input-audio-uuid', '-i', help='audio file to be split')
parser.add_argument('--crop-number', '-c', help='the number of the crop to use', type=int)
args = parser.parse_args()
print(args)

with tempfile.TemporaryDirectory() as tmp_dir:
    crop_filename = '{:03}.wav'.format(args.crop_number)
    remote_fp = os.path.join(args.input_audio_uuid, 'cropped', crop_filename)
    local_crop_fp = os.path.join(tmp_dir, 'crop.wav')
    bucket_client.download_filename_from_bucket(remote_fp, local_crop_fp)

    with tempfile.TemporaryDirectory() as tmp_output_dir:
        c = 1
        note_fps = []
        for pitch, duration in SEQUENCE:
            output_fp = os.path.join(tmp_output_dir, '{:03}.wav'.format(c))
            note_fps.append(output_fp)
            sp.call('rubberband -p {} -t {} {} {}'.format(pitch, duration, local_crop_fp, output_fp), shell=True)
            c += 1

        out_fp = os.path.join(tmp_output_dir, 'combined.wav')

        sounds = [AudioSegment.from_wav(fp) for fp in note_fps]
        combined_sounds = None
        for sound in sounds:
            if not combined_sounds:
                combined_sounds = sound
            else:
                combined_sounds = combined_sounds + sound
        combined_sounds.export(out_fp, format='wav')
        bucket_client.upload_filename_to_bucket(out_fp, os.path.join(args.input_audio_uuid, 'sequence/{:03}.wav'.format(1)))
