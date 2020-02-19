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
import logger
from bucket_client import download_from_bucket, upload_to_bucket
import wave
import argparse
from pydub import AudioSegment
import sqlite3
import uuid
import warnings
warnings.filterwarnings('ignore')

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
parser.add_argument('--crop-uuid', '-c', help='the uuid of the crop file to use', type=str)
parser.add_argument('--user-id', '-u', help='the user id', type=str)
args = parser.parse_args()


def get_sequence_count (cur, user_id):
    sequence_count_sql = '''
        SELECT count(*) from sequences 
        WHERE 
            user_id = :user_id
        ;
    '''
    cur.execute(sequence_count_sql, {
        'user_id': user_id,
    })
    try:
        sequence_count = int(cur.fetchone()[0])
    except:
        sequence_count = 0
    return sequence_count


def aac_to_wav (aac_fp):
    with warnings.catch_warnings():
        wav_fp = aac_fp.replace('.aac', '.wav')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(aac_fp, wav_fp), shell=True)
    return wav_fp


def wav_to_aac (wav_fp):
    with warnings.catch_warnings():
        aac_fp = wav_fp.replace('.wav', '.aac')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(wav_fp, aac_fp), shell=True)
    return aac_fp
    


if __name__ == '__main__':
    logger.log('{} crop_uuid: {} started'.format(os.path.basename(__file__), args.crop_uuid))
    with warnings.catch_warnings():
        with tempfile.TemporaryDirectory() as tmp_dir:
            conn = sqlite3.connect('../server/barker_database.db')
            cur = conn.cursor()
            sequence_count = get_sequence_count(cur, args.user_id)
            cur.execute('select bucket_fp, uuid, raw_id from crops where uuid = ?', [args.crop_uuid])
            remote_fp, crop_fk, raw_fk = cur.fetchone()
            local_crop_fp = os.path.join(tmp_dir, 'crop.aac')
            bucket_client.download_filename_from_bucket(remote_fp, local_crop_fp)
            local_crop_fp_wav = aac_to_wav(local_crop_fp)
            with tempfile.TemporaryDirectory() as tmp_output_dir:
                c = 1
                note_fps = []
                for pitch, duration in SEQUENCE:
                    output_fp = os.path.join(tmp_output_dir, '{:03}.wav'.format(c))
                    note_fps.append(output_fp)
                    sp.call('rubberband -p {} -t {} {} {}'.format(pitch, duration, local_crop_fp_wav, output_fp), shell=True)
                    c += 1

                combined_fp = os.path.join(tmp_output_dir, 'combined.wav')

                sounds = [AudioSegment.from_wav(fp) for fp in note_fps]
                combined_sounds = None
                for sound in sounds:
                    if not combined_sounds:
                        combined_sounds = sound
                    else:
                        combined_sounds = combined_sounds + sound
                combined_sounds.export(combined_fp, format='wav')
                combined_fp_aac = wav_to_aac(combined_fp)
                sequence_uuid = uuid.uuid4()
                remote_sequence_fp = '{}/sequences/{}.aac'.format(raw_fk, sequence_uuid)
                remote_sequence_url = 'gs://{}'.format(remote_sequence_fp)
                cur.execute('''
                        INSERT INTO sequences VALUES (
                            :uuid,
                            :crop_id,
                            :user_id,
                            :name,
                            :bucket_url,
                            :bucket_fp,
                            :stream_url,
                            :hidden
                        )
                    ''', 
                    {
                        'uuid': str(sequence_uuid),
                        'crop_id': args.crop_uuid,
                        'user_id': args.user_id, 
                        'name': 'Happy Barkday {}'.format(sequence_count + 1),
                        'bucket_url': remote_sequence_url,
                        'bucket_fp': remote_sequence_fp,
                        'stream_url': None,
                        'hidden': 0,
                    }
                )
                bucket_client.upload_filename_to_bucket(combined_fp_aac, remote_sequence_fp)
            conn.commit()
            conn.close()
    print(sequence_uuid, remote_sequence_url)
    logger.log('{} crop_uuid: {} succeeded'.format(os.path.basename(__file__), args.crop_uuid))
