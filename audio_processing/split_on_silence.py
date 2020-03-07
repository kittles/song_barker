# NOTE THIS IS DEPRECATED
import os
import logger
import bucket_client
import tempfile
import argparse
from pyAudioAnalysis import audioSegmentation as audio_seg
from pyAudioAnalysis import audioBasicIO
import scipy.io.wavfile as wavfile
import sqlite3
import uuid
import subprocess as sp
import warnings
warnings.filterwarnings('ignore')
'''
inspiration: https://walczak.org/2019/02/automatic-splitting-audio-files-silence-python/
'''


def get_crop_count (cur, user_id, raw_id):
    # used to give crops a default name based on the pet
    # select all crops for pet
    # give crop the name <pet_name>_<len(crops)>
    pet_sql = '''
        SELECT pet_id, name from pets
        WHERE
            pet_id = (SELECT pet_id from raws where uuid = :raw_id)
        ;
    '''
    cur.execute(pet_sql, {
        'raw_id': raw_id,
    })
    try:
        pet_id, pet_name = cur.fetchone()
    except:
        # what to do if no pet...
        pet_id = None
        pet_name = 'no name'
    crop_count_sql = '''
        SELECT count(*) from crops 
        WHERE 
            user_id = :user_id
        AND
            pet_id = :pet_id
        ;
    '''
    cur.execute(crop_count_sql, {
        'user_id': user_id,
        'pet_id': pet_id,
    })
    try:
        crop_count = int(cur.fetchone()[0])
    except:
        crop_count = 0
    return {
        'pet_name': pet_name,
        'crop_count': crop_count,
    }


# more aggressive
smoothing_window = 0.05
weight = 0.15

parser = argparse.ArgumentParser()
parser.add_argument('--input-audio-uuid', '-i', help='audio file to be split')
parser.add_argument('--user-id', '-u', help='user_id')
parser.add_argument('--pet-id', '-p', help='pet_id')
args = parser.parse_args()

if __name__ == '__main__':
    logger.log('{} input_audio_uuid: {} started'.format(os.path.basename(__file__), args.input_audio_uuid))
    crop_uuids = []
    bucket_crop_paths = []
    with tempfile.TemporaryDirectory() as tmp_dir:
        remote_fp = os.path.join(args.input_audio_uuid, 'raw.aac')
        local_fp = os.path.join(tmp_dir, 'raw.aac')
        bucket_client.download_filename_from_bucket(remote_fp, local_fp)
        # convert to wav
        local_fp_wav = local_fp.replace('.aac', '.wav')
        sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(local_fp, local_fp_wav), shell=True)
        with warnings.catch_warnings():
            try:
                [fs, x] = audioBasicIO.readAudioFile(local_fp_wav)
                segmentLimits = audio_seg.silenceRemoval(x, fs, 0.025, 0.025, smoothing_window, weight)
                filenames = []
                conn = sqlite3.connect('../server/barker_database.db')
                cur = conn.cursor()
                crop_info = get_crop_count(cur, args.user_id, args.input_audio_uuid)
                for i, s in enumerate(segmentLimits):
                    crop_info['crop_count'] += 1
                    crop_uuid = uuid.uuid4()
                    crop_uuids.append(crop_uuid)
                    filename = '{}.wav'.format(crop_uuid)
                    out_fp = os.path.join(tmp_dir, filename)
                    wavfile.write(out_fp, fs, x[int(fs * s[0]):int(fs * s[1])])
                    # convert to aac
                    out_fp_aac = out_fp.replace('.wav', '.aac')
                    sp.call('ffmpeg -nostats -hide_banner -loglevel panic  -i {} {}'.format(out_fp, out_fp_aac), shell=True)
                    filename_aac = filename.replace('.wav', '.aac')
                    filenames.append(filename_aac)
                    bucket_client.upload_filename_to_bucket(out_fp_aac, os.path.join(args.input_audio_uuid, 'cropped/{}'.format(filename_aac)))
                    logger.log('crop uuid ' + str(crop_uuid));
                    cur.execute('''
                            INSERT INTO crops VALUES (
                                :uuid,
                                :raw_id,
                                :user_id,
                                :pet_id,
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
                            'pet_id': args.pet_id, 
                            'name': '{} {}'.format(crop_info['pet_name'], crop_info['crop_count']),
                            'bucket_url': os.path.join('gs://{}'.format(args.input_audio_uuid), 'cropped', filename_aac),
                            'bucket_fp': os.path.join(args.input_audio_uuid, 'cropped', filename_aac),
                            'stream_url': None,
                            'hidden': 0,
                        }
                    )
                    bucket_crop_paths.append(os.path.join('gs://{}'.format(args.input_audio_uuid), 'cropped', filename_aac))
                conn.commit()
                conn.close()
            except ValueError as e:
                logger.log('{} input_audio_uuid: {} failed with ValueError'.format(os.path.basename(__file__), args.input_audio_uuid))

    for cuuid, cpath in zip(crop_uuids, bucket_crop_paths):
        print(cuuid, cpath)
    logger.log('{} input_audio_uuid: {} succeeded'.format(os.path.basename(__file__), args.input_audio_uuid))

