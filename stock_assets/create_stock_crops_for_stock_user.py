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


db_fp = os.environ.get('k9_database', '../server/k9karaoke-database-prod.db')
#db_fp = '/volumes/ssd4/Turboblaster/Server/song_barker/server/k9karaoke-database-prod.db'
conn = sqlite3.connect(db_fp)
conn.row_factory = dict_factory
#conn.set_trace_callback(print)
cur = conn.cursor()

def print_row(row):
    for key in row.keys():
        print(key, row[key])


def insert_row(row):
    new_uuid = str(uuid.uuid4())
    sql = '''
            insert into crops (uuid, raw_id, user_id,
                name, bucket_url, bucket_fp, stream_url,
                is_stock, duration_seconds, crop_type )
            values({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {})
    '''.format(new_uuid, row['raw_id'], 'stock_user@k-9karaoke.com',
               row['name'], row['bucket_url'], row['bucket_fp'], row['stream_url'],
               1, row['duration_seconds'], row['crop_type'])

### run to create crops for a stock user that is used as a 'template'
### for assigning new users their stock barks and also for editing barks
#         info = json.load(open(info_fp))
#         name, crop_tupe,
#         info['uuid'] = new_uuid
#         info['bucket_url'] = os.path.join('gs://{}'.format(bucket_name), old_blob)
#         info['bucket_fp'] = old_blob
#         info['user_id'] = args.user_id
#         info['is_stock'] = 1
def create_crops_for_stock_usr():
    cur = conn.cursor()
    cur.execute('SELECT * FROM crops where user_id = "jeff@magikarts.com" and is_stock = 1')
    for row in cur.fetchall():
        info = {}
        #print_row(row)
        new_uuid = str(uuid.uuid4())
        info['uuid'] = new_uuid
        info['name'] = row['name']
        info['crop_type'] = row['crop_type']
        info['user_id'] = 'stock_user@k-9karaoke.com'
        info['is_stock'] = 1
        info['bucket_url'] = row['bucket_url']
        info['bucket_fp'] = row['bucket_fp']
        info['duration_seconds'] = row['duration_seconds']
        print(info)
        db_insert('crops', **info)
        #print(row["name"], row["duration_seconds"])
    conn.commit()


def create_crops_for_new_user(user_id):
    cur = conn.cursor()
    cur.execute('SELECT * FROM crops where user_id = "stock_user@k-9karaoke.com" and is_stock = 1')
    for row in cur.fetchall():
        info = {}
        # print_row(row)
        new_uuid = str(uuid.uuid4())
        info['uuid'] = new_uuid
        info['name'] = row['name']
        info['crop_type'] = row['crop_type']
        info['user_id'] = user_id
        info['is_stock'] = 1
        info['bucket_url'] = row['bucket_url']
        info['bucket_fp'] = row['bucket_fp']
        info['duration_seconds'] = row['duration_seconds']
        print(info)
        db_insert('crops', **info)
        # print(row["name"], row["duration_seconds"])
    conn.commit()


# should only need to execute this once.  This will create the user
# who will own the stocks
def make_stock_user():
    new_uuid = str(uuid.uuid4())
    # sql = '''
    # insert into users (user_id, name, email, password, email_confirmation_string, account_uuid)
    #     values({},{},{},{},{},{})
    # '''.format("stock@turboblaster.com", "stock", "stock@turboblaster.com", "k9", "k9", new_uuid)
    # print(sql)
#    cur.execute(sql)
    info = json.load(open('./info.json'))
    info['uuid'] = new_uuid
    info['user_id'] = 'stock'
    db_insert('crops', **info)
    print(info)
    return 0

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
        # conn.commit()
        #cur.execute('SELECT * FROM {} WHERE rowid={}'.format(table, cur.lastrowid))
        ## TODO threading concerns?
        #return cur.fetchone()
    except Exception as e:
        # TODO log
        print(e)
        return None


create_crops_for_stock_usr()

#create_crops_for_new_user('foo@bar.com')

#get_stock_crops()
#make_stock_user()
# # get user id via args
#
#
# stock_root_dir = os.path.dirname(os.path.realpath(__file__))
# images_dir = os.path.join(stock_root_dir, 'images')
# crops_dir = os.path.join(stock_root_dir, 'barks')
#
# # images on bucket at stock_assets/images
# # barks on bucket at stock_assets/crops
# crop_bucket_base = 'stock_assets/crops'

# if __name__ == '__main__':
#     parser = argparse.ArgumentParser()
#     parser.add_argument('--user-id', '-u', help='the user id to which these objects will be associated')
#     args = parser.parse_args()
#
#     # this lets you update existing users stock objects just by running this script
#     cur.execute('DELETE FROM crops WHERE user_id = "{}" AND is_stock = 1'.format(args.user_id))
#
#     bucket_name = os.environ.get('k9_bucket_name', 'song_barker_sequences')
#
#
#     for crop_dir in glob.glob(os.path.join(crops_dir, '*/')):
#         crop_fp = glob.glob(os.path.join(crop_dir, '*.aac'))[0]
#         info_fp = glob.glob(os.path.join(crop_dir, 'info.json'))[0]
#         info = json.load(open(info_fp))
#         # new uuid, but use existing bucket_fp and bucket_url
#         new_uuid = str(uuid.uuid4())
#         old_blob = os.path.join(crop_bucket_base, info['uuid'] + '.aac')
#         info['uuid'] = new_uuid
#         info['bucket_url'] = os.path.join('gs://{}'.format(bucket_name), old_blob)
#         info['bucket_fp'] = old_blob
#         info['user_id'] = args.user_id
#         info['is_stock'] = 1
#         db_insert('crops', **info)
#
#     conn.commit()
