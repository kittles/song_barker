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


conn = sqlite3.connect('../server/barker_database.db')
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
    row = cur.fetchone()
    base_name = row.get('name', 'sound')

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
    row = cur.fetchone()
    crop_count = int(row.get('count(*)', 0))

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
    row = cur.fetchone()
    sequence_count = int(row.get('count(*)', 0))
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
    return CropSampler(wav_fp, tmp_dir)


def midi_bridge_from_song_id (song_id, tmp_dir):
    cur.execute('SELECT name, bucket_fp FROM songs WHERE id = :song_id', {
        'song_id': song_id,
    })
    row = cur.fetchone()
    return MidiBridge(row['bucket_fp'], tmp_dir, True)
