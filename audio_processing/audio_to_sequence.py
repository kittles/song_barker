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
from google.cloud import storage


THRESHOLD = 0.008
AVERAGE_BANDWIDTH = 2048
SAMPLERATE = 48000
# mocked
SEQUENCE = [
    (-5, 1),
    (-5, 1),
    (-3, 2),
    (-5, 2),
    (0, 2),
    (-1, 4),
]


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


def to_cropped_audio (crops, audio_arr, out_fp):
    write(out_fp, SAMPLERATE, audio_arr[crops[0]:crops[1]])


def crop_audio (audio_fp, out_fp='output/cropped/cropped.wav'):
    raw = audio_fp_to_nparray(audio_fp)
    data = normalize(raw)
    avg = average(data, AVERAGE_BANDWIDTH)
    crossings = threshold_crossings(avg)
    crops = crops_from_crossings(crossings)
    to_cropped_audio(crops, raw, out_fp)


def to_audio_sequence (audio_fp, in_dir=None, out_fp=None, sequence=SEQUENCE):
    f = sf.SoundFile(audio_fp)
    crop_duration = len(f) / f.samplerate
    # quarter note is .5 seconds, so get the scalar to do that
    scalar = crop_duration / 0.5
    c = 1
    for pitch, duration in sequence:
        sp.call('rubberband -p {} -t {} {} {}/{:03}.wav'.format(pitch, duration / scalar, audio_fp, in_dir, c), shell=True)
        c += 1

    infiles = sorted(glob.glob(os.path.join(in_dir, '*.wav')))
    sounds = [AudioSegment.from_wav(fp) for fp in infiles]
    combined_sounds = None
    for sound in sounds:
        if not combined_sounds:
            combined_sounds = sound
        else:
            combined_sounds = combined_sounds + sound
    combined_sounds.export(out_fp, format='wav')


if __name__ == '__main__':
    logfile = open('log.txt', 'a')
    input_fp = sys.argv[1]
    render_fp = sys.argv[2]
    uuid = sys.argv[3]
    logfile.write('{} {} starting audio_to_sequence.py\n'.format(dt.datetime.now(), uuid))

    tmp_dir = os.path.join('tmp', uuid)
    tmp_input = os.path.join(tmp_dir, 'input_audio')
    tmp_input_fp = os.path.join(tmp_input, 'input_audio.wav')
    tmp_cropped = os.path.join(tmp_dir, 'cropped')
    tmp_cropped_fp = os.path.join(tmp_cropped, 'cropped.wav')
    tmp_sequence = os.path.join(tmp_dir, 'sequence')
    sequence_fp = os.path.join(tmp_dir, 'sequence.wav')

    os.mkdir(tmp_dir)
    os.mkdir(tmp_input)
    os.mkdir(tmp_cropped)
    os.mkdir(tmp_sequence)

    storage_client = storage.Client()

    bucket = storage_client.bucket('song_barker_sequences')
    blob = bucket.blob(input_fp)
    blob.download_to_filename(tmp_input_fp)
    logfile.write('{} {} finished downloading input audio\n'.format(dt.datetime.now(), uuid))

    sequence_fp = os.path.join(tmp_dir, 'sequence', 'sequence.wav')
    crop_audio(tmp_input_fp, out_fp=tmp_cropped_fp)
    logfile.write('{} {} finished cropping\n'.format(dt.datetime.now(), uuid))

    to_audio_sequence(tmp_cropped_fp, in_dir=tmp_sequence, out_fp=sequence_fp)
    logfile.write('{} {} finished sequencing\n'.format(dt.datetime.now(), uuid))

    bucket = storage_client.bucket('song_barker_sequences')
    blob = bucket.blob(render_fp)
    blob.upload_from_filename(sequence_fp)
    logfile.write('{} {} finished uploading generated sequence\n'.format(dt.datetime.now(), uuid))
