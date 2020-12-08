import sqlite3
import glob
import json
import os
import uuid
import argparse


def dict_factory (cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d


db_fp = os.environ.get('k9_database', '../server/barker_database.db')
conn = sqlite3.connect(db_fp)
conn.row_factory = dict_factory
#conn.set_trace_callback(print)
cur = conn.cursor()


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
        # wait to commit because you may want to delete old stock stuff
        # before committing
        #conn.commit()
        #cur.execute('SELECT * FROM {} WHERE rowid={}'.format(table, cur.lastrowid))
        ## TODO threading concerns?
        #return cur.fetchone()
    except Exception as e:
        # TODO log
        print(e)
        return None


# get user id via args


stock_root_dir = os.path.dirname(os.path.realpath(__file__))
images_dir = os.path.join(stock_root_dir, 'images')
crops_dir = os.path.join(stock_root_dir, 'barks')

# images on bucket at stock_assets/images
# barks on bucket at stock_assets/crops
image_bucket_base = 'stock_assets/images'
crop_bucket_base = 'stock_assets/crops'

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id', '-u', help='the user id to which these objects will be associated')
    args = parser.parse_args()

    # this lets you update existing users stock objects just by running this script
    cur.execute('DELETE FROM images WHERE user_id = "{}" AND is_stock = 1'.format(args.user_id))
    cur.execute('DELETE FROM crops WHERE user_id = "{}" AND is_stock = 1'.format(args.user_id))

    bucket_name = os.environ.get('k9_bucket_name', 'song_barker_sequences')

    for img_dir in glob.glob(os.path.join(images_dir, '*/')):
        # TODO handle other image extensions
        img_fp = glob.glob(os.path.join(img_dir, '*.jpg'))[0]
        info_fp = glob.glob(os.path.join(img_dir, 'info.json'))[0]
        info = json.load(open(info_fp))
        # new uuid, but use existing bucket_fp and bucket_url
        new_uuid = str(uuid.uuid4())
        old_blob = os.path.join(image_bucket_base, info['uuid'] + '.jpg')
        info['uuid'] = new_uuid
        info['coordinates_json'] = json.dumps(info['coordinates_json'])
        info['mouth_color'] = json.dumps(info['mouth_color'])
        info['bucket_url'] = os.path.join('gs://{}'.format(bucket_name), old_blob)
        info['bucket_fp'] = old_blob
        info['user_id'] = args.user_id
        info['is_stock'] = 1
        db_insert('images', **info)


    for crop_dir in glob.glob(os.path.join(crops_dir, '*/')):
        crop_fp = glob.glob(os.path.join(crop_dir, '*.aac'))[0]
        info_fp = glob.glob(os.path.join(crop_dir, 'info.json'))[0]
        info = json.load(open(info_fp))
        # new uuid, but use existing bucket_fp and bucket_url
        new_uuid = str(uuid.uuid4())
        old_blob = os.path.join(crop_bucket_base, info['uuid'] + '.aac')
        info['uuid'] = new_uuid
        info['bucket_url'] = os.path.join('gs://{}'.format(bucket_name), old_blob)
        info['bucket_fp'] = old_blob
        info['user_id'] = args.user_id
        info['is_stock'] = 1
        db_insert('crops', **info)

    conn.commit()
