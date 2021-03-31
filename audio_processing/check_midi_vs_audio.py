'''
used for debugging midi vs audio timing issues
'''
import os
from midi_bridge import MidiBridge
from scipy.io import wavfile
from matplotlib import pyplot as plt
from scipy import signal
import numpy as np
import audio_conversion as ac


# TODO argument parser
dir_path = os.path.dirname(os.path.realpath(__file__))

# generate a visual check for all songs
d = os.path.join(dir_path, '../songs')
song_dirs = [os.path.join(d, o) for o in os.listdir(d) if os.path.isdir(os.path.join(d, o))]
for song_dir in song_dirs:
    print(song_dir)
    midi_fp = os.path.join(song_dir, 'song.mid')
    audio_fp = os.path.join(song_dir, 'A.aac')
    if not os.path.exists(audio_fp):
        audio_fp = os.path.join(song_dir, 'a.aac')

    output_audio_fp = '/home/patrick/Desktop/check_song.wav'

    wav_fp = ac.aac_to_wav(audio_fp)

    # get a mono 44100 audio
    rate, audio_data = wavfile.read(wav_fp)
    if audio_data.ndim == 2:
        audio_data = audio_data.sum(axis=1) / 2
    # resample
    if rate != 44100:
        duration = len(audio_data) / rate
        audio_data = signal.resample(audio_data, int(samplerate * duration))
    # convert to 32 bit float
    audio_data = audio_data.astype(np.float32)
    # normalize
    audio_data = audio_data / np.max(audio_data)


    # get all the spots notes start
    mb = MidiBridge(midi_fp, None, False)
    midi_xs = []
    midi_ys = []
    for track in mb.tracks:
        for note in track['notes']:
            midi_xs.append(mb.ticks_to_samples(note['time'], 44100))
            midi_ys.append(0)

    plt.plot(audio_data, zorder=1)
    plt.scatter(midi_xs, midi_ys, color='red', marker='x', zorder=2)
    plt.title('midi file: {}\n audio file: {}\n bpm: {}'.format(midi_fp, audio_fp, mb.bpm))
    plt.show()


    ## add audio markers indicating where notes will be
    #frequency = 440
    #length = 0.05

    #t = np.linspace(0, length, int(44100 * length))
    #audio_marker = np.sin(frequency * 2 * np.pi * t)

    #for x in midi_xs:
    #    try:
    #        audio_data[x:x + len(audio_marker)] += audio_marker
    #    except:
    #        continue

    #audio_data /= max(audio_data)
    #wavfile.write(output_audio_fp, 44100, audio_data)

    os.remove(wav_fp)
