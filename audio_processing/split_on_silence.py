import os
import bucket_client
import tempfile
import argparse
from pyAudioAnalysis import audioSegmentation as audio_seg
from pyAudioAnalysis import audioBasicIO
import scipy.io.wavfile as wavfile
import sqlite3
import uuid
'''
inspiration: https://walczak.org/2019/02/automatic-splitting-audio-files-silence-python/
'''

smoothing_window = 1.0
weight = 0.3

parser = argparse.ArgumentParser()
parser.add_argument('--input-audio-uuid', '-i', help='audio file to be split')
args = parser.parse_args()

with tempfile.TemporaryDirectory() as tmp_dir:
    remote_fp = os.path.join(args.input_audio_uuid, 'raw.wav')
    local_fp = os.path.join(tmp_dir, 'raw.wav')
    bucket_client.download_filename_from_bucket(remote_fp, local_fp)
    [fs, x] = audioBasicIO.readAudioFile(local_fp)
    segmentLimits = audio_seg.silenceRemoval(x, fs, 0.05, 0.05, smoothing_window, weight)
    filenames = []
    conn = sqlite3.connect('../server/barker_database.db')
    c = conn.cursor()
    for i, s in enumerate(segmentLimits):
        crop_uuid = uuid.uuid4()
        filename = '{}.wav'.format(crop_uuid)
        filenames.append(filename)
        out_fp = os.path.join(tmp_dir, filename)
        wavfile.write(out_fp, fs, x[int(fs * s[0]):int(fs * s[1])])
        bucket_client.upload_filename_to_bucket(out_fp, os.path.join(args.input_audio_uuid, 'cropped/{}'.format(filename)))
        c.execute('INSERT INTO crops VALUES (?, ?, ?, ?, ?, ?)', [
            'dont-matter',
            str(crop_uuid),
            args.input_audio_uuid,
            None,
            os.path.join('gs://{}'.format(args.input_audio_uuid), 'cropped', filename),
            None
        ])
    conn.commit()
    conn.close()
