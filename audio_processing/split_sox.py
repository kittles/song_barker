import numpy as np
import tempfile
import scipy.io.wavfile as wavfile
import sqlite3
import uuid
import subprocess as sp
import glob
import warnings
import os
import logger
import bucket_client
import argparse
import time


THRESHOLD = 300000 # min sum of abs value of all pcm samples

log = logger.log_fn(os.path.basename(__file__)) 

        
parser = argparse.ArgumentParser()
parser.add_argument('--input-audio-uuid', '-i', help='audio file to be split')
parser.add_argument('--user-id', '-u', help='user_id')
parser.add_argument('--debug', '-d', action='store_true', help='playback audio crops', default=False)
args = parser.parse_args()

if not args.debug:
    warnings.filterwarnings('ignore')


def get_crop_defaults (cur, user_id, raw_id):
    # if raw has name, use that, otherwise use sound_

    # get raw entry in db for base name
    raw_sql = '''
        SELECT uuid, name from raws
        WHERE
        uuid = :uuid
    '''
    cur.execute(raw_sql, {
        'uuid': raw_id,
    })
    try:
        _, base_name = cur.fetchone()
    except:
        base_name = 'sound'
    if base_name is None:
        base_name = 'sound'

    # get crop count
    crop_count_sql = '''
        SELECT count(*) from crops 
        WHERE 
            user_id = :user_id
        AND
            name like '{}%'
        ;
    '''.format(base_name)
    cur.execute(crop_count_sql, {
        'user_id': user_id,
    })
    try:
        crop_count = int(cur.fetchone()[0])
    except:
        crop_count = 0

    return {
        'base_name': base_name,
        'crop_count': crop_count,
    }


if __name__ == '__main__':
    log(args.input_audio_uuid, 'starting...')

    # make a raw entry in the db
    conn = sqlite3.connect('../server/barker_database.db')
    cur = conn.cursor()
    raw_insert_sql = 'INSERT INTO raws (uuid, user_id) VALUES (:uuid, :user_id)' 
    cur.execute(raw_insert_sql, {
        'uuid': args.input_audio_uuid,
        'user_id': args.user_id,
    })
    conn.commit()

    crop_uuids = []
    bucket_crop_paths = []
    crop_info = {} # comes from fn

    with tempfile.TemporaryDirectory() as tmp_dir:

        # get the raw input file
        remote_fp = os.path.join(args.input_audio_uuid, 'raw.aac')
        local_fp_aac = os.path.join(tmp_dir, 'raw.aac')
        bucket_client.download_filename_from_bucket(remote_fp, local_fp_aac)

        # convert to wav
        local_fp_wav = local_fp_aac.replace('.aac', '.wav')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(local_fp_aac, local_fp_wav), shell=True)

        # split with sox
        split_cmd = 'sox {in_fp} {out_fp_prefix} silence 1 0.3 0.001% 1 0.1 1% : newfile : restart'
        split_args = {
            'in_fp': local_fp_wav,
            'out_fp_prefix': os.path.join(tmp_dir, 'crop_.wav'),
        }
        sp.call(split_cmd.format(**split_args), shell=True)

        # log initial split count
        result = sp.run('ls {} | wc -l'.format(os.path.join(tmp_dir, 'crop_*.wav')), 
                stdout=sp.PIPE, stderr=sp.PIPE, universal_newlines=True, shell=True)
        log(args.input_audio_uuid, 'initial split count {}'.format(
            result.stdout
        ))

        # filter crops that are too quiet
        good_crops = []
        for crop_fp in glob.glob(os.path.join(tmp_dir, 'crop_*.wav')):
            samplerate, data = wavfile.read(crop_fp)
            if np.sum(abs(data)) > THRESHOLD:
                good_crops.append(crop_fp)
        log(args.input_audio_uuid, 'filtered split count {}'.format(
            len(good_crops)
        ))
        if args.debug:
            for crop in good_crops:
                sp.call('play {}'.format(crop), shell=True)
                keep_going = input()
                if keep_going != 'q':
                    continue
                else:
                    break

        #crop_info = get_crop_count(cur, args.user_id, args.input_audio_uuid)
        crop_info = get_crop_defaults(cur, args.user_id, args.input_audio_uuid)

        # upload good crops and log in db
        for crop_fp_wav in good_crops:
            if args.debug:
                print(crop_fp_wav)
            crop_info['crop_count'] += 1
            crop_uuid = uuid.uuid4()
            crop_uuids.append(crop_uuid)

            # convert to aac
            crop_fp_aac = crop_fp_wav.replace('.wav', '.aac')
            sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(crop_fp_wav, crop_fp_aac), shell=True)

            # upload to bucket
            bucket_filename = '{}.aac'.format(crop_uuid)
            bucket_fp = os.path.join(args.input_audio_uuid, 'cropped', bucket_filename)
            bucket_url = os.path.join('gs://', 'song_barker_sequences', bucket_fp)
            bucket_client.upload_filename_to_bucket(crop_fp_aac, bucket_fp)

            # this is just a placeholder for the user based on existing count of crops from a specific pet_id
            auto_name = '{}_{}'.format(crop_info['base_name'], crop_info['crop_count'])
            if args.debug:
                print('auto name', auto_name)

            # record in db
            cur.execute('''
                    INSERT INTO crops VALUES (
                        :uuid,
                        :raw_id,
                        :user_id,
                        :name,
                        :bucket_url,
                        :bucket_fp,
                        :stream_url,
                        :hidden
                    )
                ''',
                {
                    'uuid': str(crop_uuid),
                    'raw_id': args.input_audio_uuid,
                    'user_id': args.user_id, 
                    'name': auto_name,
                    'bucket_url': bucket_url,
                    'bucket_fp': bucket_fp,
                    'stream_url': None,
                    'hidden': 0,
                }
            )
            bucket_crop_paths.append(bucket_url)

        conn.commit()
        conn.close()

    # send to stdout for consumption by server
    for cuuid, cpath in zip(crop_uuids, bucket_crop_paths):
        print(cuuid, cpath)

    log(args.input_audio_uuid, 'finished')

