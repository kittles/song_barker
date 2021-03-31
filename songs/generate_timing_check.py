'''
this was used to debug timing issues between the rendered sequence and a backing
track, i think

generates 5 bars of a click track at 143 bpm
'''
import os
from scipy.io import wavfile
from matplotlib import pyplot as plt
from scipy import signal
import numpy as np


bpm = 143
bars = 5
samplerate = 44100
samples_per_beat = (samplerate * 60) / bpm
audio_data = np.zeros(int((bars * 4) * samples_per_beat))

quarter_freq = 440
bar_freq = quarter_freq * 2
click_dur = 0.025

quarter_samples = np.linspace(0, click_dur, int(samplerate * click_dur))
quarter_marker = np.sin(quarter_freq * 2 * np.pi * quarter_samples)

bar_samples = np.linspace(0, click_dur, int(samplerate * click_dur))
bar_marker = np.sin(bar_freq * 2 * np.pi * bar_samples)


for beat in range(5 * 4):
    start_idx = int(beat * samples_per_beat)
    end_idx = start_idx + len(quarter_marker)
    audio_data[start_idx:end_idx] += quarter_marker


for bar in range(5):
    start_idx = int(4 * bar * samples_per_beat)
    end_idx = start_idx + len(bar_marker)
    audio_data[start_idx:end_idx] += bar_marker

audio_data /= max(audio_data)
for key in ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']:
    wavfile.write('{}.wav'.format(key), 44100, audio_data)
    #ac.wav_to_aac('{}.wav'.format(key))
