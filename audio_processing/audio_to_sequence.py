import numpy as np
from scipy.io.wavfile import read, write
from matplotlib import pyplot as plt
import subprocess as sp
import wave
import glob
from pydub import AudioSegment
import soundfile as sf


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


def to_audio_sequence (audio_fp, sequence=SEQUENCE):
    f = sf.SoundFile(audio_fp)
    crop_duration = len(f) / f.samplerate
    # quarter note is .5 seconds, so get the scalar to do that
    scalar = crop_duration / 0.5
    c = 1
    for pitch, duration in sequence:
        sp.call('rubberband -p {} -t {} {} output/tmp/{:03}.wav'.format(pitch, duration / scalar, audio_fp, c), shell=True)
        c += 1

    infiles = sorted(glob.glob('output/tmp/*.wav'))
    out_fp = 'output/sequences/sequence.wav'
    sounds = [AudioSegment.from_wav(fp) for fp in infiles]
    combined_sounds = None
    for sound in sounds:
        if not combined_sounds:
            combined_sounds = sound
        else:
            combined_sounds = combined_sounds + sound
    combined_sounds.export(out_fp, format='wav')


if __name__ == '__main__':
    crop_audio('sample_audio/sample_woof_3.wav')
    to_audio_sequence('output/cropped/cropped.wav')
