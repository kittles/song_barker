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


parser = argparse.ArgumentParser()
parser.add_argument('--uuid', '-u', help='the uuid of the crop file to use', type=str)
args = parser.parse_args()


def aac_to_wav (aac_fp):
    with warnings.catch_warnings():
        wav_fp = aac_fp.replace('.aac', '.wav')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(aac_fp, wav_fp), shell=True)
    return wav_fp


if __name__ == '__main__':

    # load the song from the db
    conn = sqlite3.connect('../server/barker_database.db')
    cur = conn.cursor()
    cur.execute('SELECT name, bucket_fp FROM crops where uuid = :uuid', {
        'uuid': args.uuid,
    })
    crop_name, crop_fp = cur.fetchone()

    with tempfile.TemporaryDirectory() as tmp_dir:
        local_fp = os.path.join(tmp_dir, 'sound.aac')
        bucket_client.download_filename_from_bucket(crop_fp, local_fp)
        local_wav = aac_to_wav(local_fp)
        print('playing {} {}'.format(crop_name, args.uuid))
        sp.call('play {}'.format(local_wav), shell=True)
