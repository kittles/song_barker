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

# TODO make sure crop doesnt result in an empty file


THRESHOLD = 0.008
AVERAGE_BANDWIDTH = 2048
SAMPLERATE = 48000


def audio_fp_to_nparray (fp):
    a = read(fp)
    return np.array(a[1])


def normalize (arr):
    normed = np.abs(arr)
    return normed / normed.max()


def average (arr, bandwidth=AVERAGE_BANDWIDTH):
    avg = [np.average(arr[i:i+bandwidth]) for i in range(len(arr) - bandwidth)]
    return np.concatenate((np.zeros((int(bandwidth/2))), avg))


def sample_index_to_timestamp (sample_idx):
    return sample_idx/SAMPLERATE


def threshold_crossings (arr, threshold=THRESHOLD):
    # sample indicies where avg goes from below to above threshold
    crossings = []
    for idx, i in enumerate(arr):
        # crossing up
        if (i > threshold) and (arr[idx - 1] <= threshold):
            crossings.append([idx, 1])
        # crossing down
        if (i < threshold) and (arr[idx - 1] >= threshold):
            crossings.append([idx, 0])
    return crossings
            

def crops_from_crossings (crossings):
    start = min([i[0] for i in crossings if i[1] == 1])
    end = max([i[0] for i in crossings if i[1] == 0])
    return start, end


def crop_audio (audio_fp, out_fp='output/cropped/cropped.wav'):
    raw = audio_fp_to_nparray(audio_fp)
    data = normalize(raw)
    avg = average(data, AVERAGE_BANDWIDTH)
    crossings = threshold_crossings(avg)
    crops = crops_from_crossings(crossings)
    to_cropped_audio(crops, raw, out_fp)


parser = argparse.ArgumentParser()
parser.add_argument('--input', help='the file to be cropped')
parser.add_argument('--dest', help='where to put the cropped file')
args = parser.parse_args()

log('start crop audio {}'.format(args.input))
input_audio = download_from_bucket(args.input)
input_audio.seek(0)
# TODO why do i need to put this in BytesIO() again?
rate, raw = read(BytesIO(input_audio.read()))
raw = np.array(raw)
normed = normalize(raw)
avg = average(normed, AVERAGE_BANDWIDTH)
crossings = threshold_crossings(avg)
crops = crops_from_crossings(crossings)
bytestream = BytesIO()
write(bytestream, SAMPLERATE, raw[crops[0]:crops[1]])
upload_to_bucket(bytestream, args.dest)
log('finish crop audio {}'.format(args.input))
