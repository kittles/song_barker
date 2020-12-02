import os
import tempfile
import bucket_client as bc
from crop_sampler import CropSampler
from midi_bridge import MidiBridge
import audio_conversion as ac
import sqlite3



def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d


db_fp = os.environ.get('k9_database', '../server/barker_database.db')
conn = sqlite3.connect(db_fp)
conn.row_factory = dict_factory
#conn.set_trace_callback(print)
cur = conn.cursor()


def get_crop_defaults (user_id, image_id):
    # get raw entry in db for base name
    raw_sql = '''
        SELECT name FROM images
        WHERE
        uuid = :image_id
    '''
    cur.execute(raw_sql, {
        'image_id': image_id,
    })
    try:
        row = cur.fetchone()
        base_name = row.get('name', 'sound')
    except:
        base_name = 'sound'

    # get crop count
    crop_count_sql = '''
        SELECT count(*) FROM crops 
        WHERE 
            user_id = :user_id
        AND
            name LIKE '{}%'
        ;
    '''.format(base_name)
    cur.execute(crop_count_sql, {
        'user_id': user_id,
    })
    try:
        row = cur.fetchone()
        crop_count = int(row.get('count(*)', 0))
    except:
        crop_count = 0

    return {
        'base_name': base_name,
        'crop_count': crop_count,
    }


def get_sequence_count (user_id, song_id):
    cur.execute('SELECT name, bucket_fp FROM songs where id = :song_id', {
        'song_id': song_id,
    })
    row = cur.fetchone()

    sequence_count_sql = '''
        SELECT count(*) FROM sequences 
        WHERE 
            user_id = :user_id
        AND
            name LIKE :song_name
        ;
    '''
    cur.execute(sequence_count_sql, {
        'user_id': user_id,
        'song_name': '%{}%'.format(row['name']),
    })
    try:
        row = cur.fetchone()
        sequence_count = int(row.get('count(*)', 0))
    except:
        sequence_count = 0
    return sequence_count


def get_song_name (song_id):
    cur.execute('SELECT name FROM songs where id = :song_id', {
        'song_id': song_id,
    })
    row = cur.fetchone()
    return row.get('name')


def get_song (song_id):
    cur.execute('SELECT * FROM songs where id = :song_id', {
        'song_id': song_id,
    })
    row = cur.fetchone()
    return row


def get_crop_raw_fk (crop_uuid):
    cur.execute('SELECT raw_id FROM crops WHERE uuid = ?', [crop_uuid])
    row = cur.fetchone()
    return row.get('raw_id')


def get_crop_fp (crop_uuid):
    cur.execute('SELECT bucket_fp FROM crops WHERE uuid = ?', [crop_uuid])
    row = cur.fetchone()
    return row.get('bucket_fp')


def db_insert (table, **kwargs):
    try:
        columns = kwargs.keys()
        columns_sql = ', '.join(columns)
        values_sql = ', '.join([':' + c for c in columns])
        raw_insert_sql = '''
            INSERT INTO {} ({}) 
            VALUES ({})
        '''.format(table, columns_sql, values_sql)
        cur.execute(raw_insert_sql, kwargs)
        conn.commit()
        cur.execute('SELECT * FROM {} WHERE rowid={}'.format(table, cur.lastrowid))
        # TODO threading concerns?
        return cur.fetchone()
    except Exception as e:
        # TODO log
        print(e)
        return None


def crop_sampler_from_uuid (uuid, tmp_dir):
    cur.execute('SELECT bucket_fp FROM crops WHERE uuid = ?', [uuid])
    row = cur.fetchone()
    crop_aac = os.path.join(tmp_dir, '{}.aac'.format(uuid))
    bc.download_filename_from_bucket(row['bucket_fp'], crop_aac)
    wav_fp = ac.aac_to_wav(crop_aac)
    #import subprocess as sp
    #sp.call('ffmpeg -i {}'.format(wav_fp), shell=True)
    #sp.call('play {}'.format(wav_fp), shell=True)
    return CropSampler(wav_fp, tmp_dir)


def midi_bridge_from_song_id (song_id, tmp_dir):
    cur.execute('SELECT name, bucket_fp FROM songs WHERE id = :song_id', {
        'song_id': song_id,
    })
    row = cur.fetchone()
    return MidiBridge(row['bucket_fp'], tmp_dir, True)


if __name__ == '__main__':
    import shutil
    import uuid

    test_uuids = [
        #'7ddc9800-9424-41a2-825b-67b85910560e',
        #'37b63248-d73c-41f7-82a5-81a992a99542',
        #'6a6dafca-8966-49f8-bcaf-8d1eb7596f74',
        #'defeeb63-cab0-4fce-9d0b-b4f8dbe05122'
        'ca7384e5-d0b4-48c1-8a00-d77c650531ab'
    ]
    with tempfile.TemporaryDirectory() as tmp_dir:
        for test_uuid in test_uuids:
            print(test_uuid)
            co = crop_sampler_from_uuid(test_uuid, tmp_dir)
            print(co)
            co.play_original()
            co.play(co.to_pitch_duration(60, 1))
            print(min(co.audio_data), max(co.audio_data))
            print(sum(co.audio_data)/len(co.audio_data))
