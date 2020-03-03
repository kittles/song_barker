import numpy as np
import matplotlib.pyplot as plt
from pyAudioAnalysis import audioSegmentation as audio_seg
from pyAudioAnalysis import audioBasicIO
import tempfile
import scipy.io.wavfile as wavfile
import sqlite3
import time
import random
import uuid
import subprocess as sp
import glob
import warnings
import os
import itertools as itr
import tempfile
import cv2


warnings.filterwarnings('ignore')


def plot_waveform (in_fp, plt):
    samplerate, data = wavfile.read(in_fp)
    times = np.arange(len(data))/float(samplerate)
    plt.plot(times, data)


def analyze (in_fp, cc = 1):
    smoothing_window  = 0.6
    weight            = 0.5
    window_size       = 0.0139
    window_step       = 0.0139
    out_dir = 'tmp'
    sp.call('rm -rf tmp', shell=True)
    sp.call('mkdir tmp', shell=True)

    # plot original waveform
    plt.clf()
    plot_waveform(in_fp, plt)
    plt.title('input waveform')
    plt.savefig(os.path.join(out_dir, 'original.png'))

    # crop
    plt.clf()
    [fs, x] = audioBasicIO.readAudioFile(in_fp)
    segments = audio_seg.silenceRemoval(
            x, fs, window_size, window_step, smoothing_window, weight,
            True, os.path.join(out_dir, 'model.png')
    )
    c = 0
    for s in segments:
        c += 1
        filename = '{:05}.wav'.format(c)
        out_fp = os.path.join(out_dir, filename)
        out_fp_trim_temp = out_fp.replace('.wav', '-trim-temp.wav')
        out_fp_trim = out_fp.replace('.wav', '-trim.wav')
        wavfile.write(out_fp, fs, x[int(fs * s[0]):int(fs * s[1])])
        # trim
        cmd = 'sox {} {} silence 1 0.1 0.1% reverse'.format(out_fp, out_fp_trim_temp)
        sp.call(cmd, shell=True)
        cmd = 'sox {} {} silence 1 0.1 0.1% reverse'.format(out_fp_trim_temp, out_fp_trim)
        sp.call(cmd, shell=True)
        sp.call('rm {}'.format(out_fp_trim_temp), shell=True)

    # show crop v trim
    for crop_fp in sorted(list(glob.glob(os.path.join(out_dir, '*.wav')))):
        plt.clf()
        plot_waveform(crop_fp, plt)
        plt.title(crop_fp)
        plt.savefig(crop_fp.replace('.wav', '.png'))

    all_imgs = cv2.vconcat([
            cv2.imread(fp) 
            for fp in 
            reversed(sorted(list(glob.glob(os.path.join(out_dir, '*.png')))))
        ])
    cv2.imwrite('analysis/analysis-{:05}.png'.format(cc), all_imgs)


cc = 1
for in_fp in glob.glob('wav_samples/*.wav'):
    try:
        analyze(in_fp, cc)
    except:
        continue
    cc += 1


def all_aac_to_wav ():
    aac_fps = glob.glob('audio_samples/*/*.aac')
    for aac_fp in aac_fps:
        wav_fp = aac_fp.replace('.aac', '.wav')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(aac_fp, wav_fp), shell=True)


def all_aac_to_wav_in_dir ():
    aac_fps = glob.glob('audio_samples/*/*.aac')
    for aac_fp in aac_fps:
        wav_fp = os.path.join('wav_samples', '{}.wav'.format(uuid.uuid4()))
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(aac_fp, wav_fp), shell=True)
        


'''
Event Detection (silence removal)
ARGUMENTS:
     - signal:                the input audio signal
     - sampling_rate:               sampling freq
     - st_win, st_step:    window size and step in seconds
     - smoothWindow:     (optinal) smooth window (in seconds)
     - weight:           (optinal) weight factor (0 < weight < 1)
                          the higher, the more strict
     - plot:             (optinal) True if results are to be plotted
     - out_fp: where the graph gets saved as a png
RETURNS:
     - seg_limits:    list of segment limits in seconds (e.g [[0.1, 0.9],
                      [1.4, 3.0]] means that
                      the resulting segments are (0.1 - 0.9) seconds
                      and (1.4, 3.0) seconds
NOTE added out_fp param for saving graphs
'''
def see_crop_waveforms ():
    for crop_fp in glob.glob('crops/*.wav'):
        samplerate, data = wavfile.read(crop_fp)
        times = np.arange(len(data))/float(samplerate)
        plt.clf()
        plt.plot(times, data)
        plt.savefig(crop_fp.replace('crops/','crop_waveforms/').replace('.wav', '.png'))


def crop_duration_histogram ():
    durations = []
    for crop_fp in glob.glob('crops/*.wav'):
        samplerate, data = wavfile.read(crop_fp)
        duration = len(data)/float(samplerate)
        durations.append(duration)
    plt.hist(durations)
    plt.show()


def trim_crops ():
    audio_fps = sorted(list(glob.glob('crops/*.wav')))
    c = 0
    for audio_fp in audio_fps:
        out_fp = audio_fp.replace('crops', 'trimmed_crops')
        cmd = 'sox {} {} silence 1 0.1 1%'.format(audio_fp, out_fp)
        sp.call(cmd, shell=True)


def crop_all_files ():
    smoothing_window  = 0.6
    weight            = 0.5
    window_size       = 0.0139
    window_step       = 0.0139
    audio_fps = sorted(list(glob.glob('wav_samples/*.wav')))
    c = 0
    for audio_fp in audio_fps:
        try:
            [fs, x] = audioBasicIO.readAudioFile(audio_fp)
            segments = audio_seg.silenceRemoval(
                    x, fs, window_size, window_step, smoothing_window, weight,
                    True, audio_fp.replace('.wav', '.png')
            )
            # write to file
            for s in segments:
                c += 1
                filename = '{:05}.wav'.format(c)
                out_fp = os.path.join('crops', filename)
                wavfile.write(out_fp, fs, x[int(fs * s[0]):int(fs * s[1])])
        except:
            print(audio_fp)


def graph_all_files ():
    smoothing_window  = 0.6
    weight            = 0.5
    window_size       = 0.0139
    window_step       = 0.0139
    audio_fps = sorted(list(glob.glob('wav_samples/*.wav')))
    for audio_fp in audio_fps:
        try:
            [fs, x] = audioBasicIO.readAudioFile(audio_fp)
            segments = audio_seg.silenceRemoval(
                    x, fs, window_size, window_step, smoothing_window, weight,
                    True, audio_fp.replace('.wav', '.png')
            )
        except:
            print(audio_fp)


def grid_search_on_segment ():
    smoothing_windows = (0.6,)#np.linspace(0.05, 1, 1000)
    weight            = (0.3,) #np.linspace(0.1, 0.5, 1)
    #window            = np.linspace(0.01, 0.02, 100)#(0.025,)
    #params = [
    #    smoothing_windows,
    #    weight,
    #    window,
    #]
    window_size       = (0.0139,)#np.linspace(0.01, 0.06, 1000)
    window_step       = (0.0139,)#np.linspace(0.01, 0.04, 100)
    params = [
        smoothing_windows,
        weight,
        window_size,
        window_step,
    ]

    audio_fps = sorted(list(glob.glob('tune_samples/*.wav')))
    wav_fp = audio_fps[4]
    [fs, x] = audioBasicIO.readAudioFile(wav_fp)
    sp.call('rm graphs/*.png', shell=True)
    sp.call('rm graphs/*.wav', shell=True)
    sp.call('cp "{}" graphs/raw.wav'.format(wav_fp), shell=True)
    for idx, (smooth, weight, size, step) in enumerate(itr.product(*params)):
    #for idx, (smooth, weight, window) in enumerate(itr.product(*params)):
        try:
            #out_name = '{:05}-smooth-{:.6f}-weight-{:.6f}-size-{:.6f}-step-{:.6f}.png'.format(
            #        idx, smooth, weight, window, window) 
            #segments = audio_seg.silenceRemoval(x, fs, window, window, smooth, weight, True, 'graphs/{}'.format(out_name))
            out_name = '{:05}-smooth-{:.6f}-weight-{:.6f}-size-{:.6f}-step-{:.6f}.png'.format(
                    idx, smooth, weight, size, step) 
            segments = audio_seg.silenceRemoval(x, fs, size, step, smooth, weight, True, 'graphs/{}'.format(out_name))
        except:
            pass



def grid_search ():
    smoothing_window = 0.05
    weight = 0.15
    crop_count = 0
    for wav_fp in glob.glob('audio_samples/*/*.wav'):
        try:
            [fs, x] = audioBasicIO.readAudioFile(wav_fp)
            segments = audio_seg.silenceRemoval(x, fs, 0.025, 0.025, smoothing_window, weight)
            crop_count += len(segments)
            for i, s in enumerate(segments):
                with tempfile.TemporaryDirectory() as tmp_dir:
                    out_fp = os.path.join(tmp_dir, 'out.wav')
                    wavfile.write(out_fp, fs, x[int(fs * s[0]):int(fs * s[1])])
                    sp.call('play {}'.format(out_fp), shell=True)
                
        except:
            #print('error', wav_fp)
            pass
    print('{} crops, weight {}'.format(crop_count, weight))
