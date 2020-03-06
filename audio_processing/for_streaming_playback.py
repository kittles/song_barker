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

parser = argparse.ArgumentParser()
parser.add_argument('--sequence_uuid', '-i', help='the uuid of the sequence', type=str)
args = parser.parse_args()


def aac_to_wav (aac_fp):
    wav_fp = aac_fp.replace('.aac', '.wav')
    sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(aac_fp, wav_fp), shell=True)
    return wav_fp


def get_fp (cur, uuid):
    sequence_sql = '''
        SELECT bucket_fp from sequences 
        WHERE 
            uuid = :uuid
        ;
    '''
    cur.execute(sequence_sql, {
        'uuid': uuid,
    })
    return cur.fetchone()[0]


if __name__ == '__main__':
    logger.log('for streaming started')
    conn = sqlite3.connect('../server/barker_database.db')
    cur = conn.cursor()
    remote_fp = get_fp(cur, args.sequence_uuid)
    local_fp = '../server/public/sequence.aac'
    bucket_client.download_filename_from_bucket(remote_fp, local_fp)
    sp.call('rm {}'.format(local_fp), shell=True)
    aac_to_wav(local_fp)
    logger.log('for streaming finished')
