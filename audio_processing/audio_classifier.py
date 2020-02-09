import numpy as np
import soundfile as sf

import matplotlib.pyplot as plt

# add models dir to path
import sys
import os
yamnet_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', 'models', 'research', 'audioset', 'yamnet')
sys.path.insert(0, yamnet_dir)
import params
import yamnet as yamnet_model

params.PATCH_HOP_SECONDS = 0.1  # 10 Hz scores frame rate.
yamnet = yamnet_model.yamnet_frames_model(params)
yamnet.load_weights(os.path.join(yamnet_dir, 'yamnet.h5'))
class_names = yamnet_model.class_names(os.path.join(yamnet_dir, 'yamnet_class_map.csv'))
wav_data, sr = sf.read('sample_dog_barks/german-shephard-daniel_simon.wav', dtype=np.int16)
waveform = wav_data / 32768.0
# Sampling rate should be 16000 Hz.
#assert sr == 16000
# TODO down or upsample as needed

scores, spectrogram = yamnet.predict(np.reshape(waveform, [1, -1]), steps=1)

# Visualize the results.
plt.figure(figsize=(10, 8))

# Plot the waveform.
plt.subplot(3, 1, 1)
plt.plot(waveform)
plt.xlim([0, len(waveform)])
# Plot the log-mel spectrogram (returned by the model).
plt.subplot(3, 1, 2)
plt.imshow(spectrogram.T, aspect='auto', interpolation='nearest', origin='bottom')

# Plot and label the model output scores for the top-scoring classes.
mean_scores = np.mean(scores, axis=0)
top_N = 10
top_class_indices = np.argsort(mean_scores)[::-1][:top_N]
plt.subplot(3, 1, 3)
plt.imshow(scores[:, top_class_indices].T, aspect='auto', interpolation='nearest', cmap='gray_r')
# Compensate for the PATCH_WINDOW_SECONDS (0.96 s) context window to align with spectrogram.
patch_padding = (params.PATCH_WINDOW_SECONDS / 2) / params.PATCH_HOP_SECONDS
plt.xlim([-patch_padding, scores.shape[0] + patch_padding])
# Label the top_N classes.
yticks = range(0, top_N, 1)
plt.yticks(yticks, [class_names[top_class_indices[x]] for x in yticks])
_ = plt.ylim(-0.5 + np.array([top_N, 0]))

plt.show()
