'''
send a user_id to this script to empty the db and bucket
of that users stuff
'''
import db_queries
import argparse
import os
import json
import tempfile
import uuid
import glob
import os
from google.cloud import storage
import logger
from io import BytesIO

BUCKET_NAME = os.environ.get('k9_bucket_name', 'song_barker_sequences')
storage_client = storage.Client()

cur = db_queries.cur
conn = db_queries.conn

def delete_blob (blob_name):
    storage_client = storage.Client()
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(blob_name)
    try:
        blob.delete()
        print('Blob {} deleted.'.format(blob_name))
    except:
        print('Blob failed to delete')

# Needs device_id mods
def all_from_table (table, user_id):
    sql = '''
        SELECT * from {} WHERE user_id = :user_id
    '''.format(table)
    cur.execute(sql, {
        'user_id': user_id,
    })
    rows = cur.fetchall()
    for row in rows:
        row['table'] = table
    return rows


def all_user_rows (user_id):
    return [item for sublist in [
        # user object handled seperately
        all_from_table('raws', user_id),
        all_from_table('crops', user_id),
        all_from_table('images', user_id),
        all_from_table('sequences', user_id),
        all_from_table('decoration_images', user_id),
        all_from_table('card_audios', user_id),
        all_from_table('greeting_cards', user_id),
    ] for item in sublist]


def delete_row (row):
    # expects a table attribute added to each row
    if row.get('uuid'):
        sql = '''
            DELETE from {} WHERE uuid = :uuid
        '''.format(row['table'])
        cur.execute(sql, {
            'uuid': row['uuid'],
        })
    # dont delete stock objects in bucket
    if row.get('is_stock'):
        return
    if row.get('bucket_fp'):
        delete_blob(row['bucket_fp'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id', '-u', help='user_id to delete all stuff from')
    parser.add_argument('--debug', '-d', action='store_true', help='dont actually do anything', default=False)
    args = parser.parse_args()
    print(args.user_id)
    print("------------------")
    rows = all_user_rows(args.user_id)
    if args.debug:
        for row in rows:
            print(row)
        print('total rows:', len(rows))
        cur.execute("select * from users where user_id = :user_id", {
            'user_id' : args.user_id,
        })
        rows = cur.fetchall()
        for row in rows:
            print(row)
        cur.execute("select * from devices_users where user_id = :user_id", {
            'user_id' : args.user_id,
        })
        rows = cur.fetchall()
        for row in rows:
            print(row)
    else:
        print("Deleting assets owned by", args.user_id)
        # try:
        #     for row in rows:
        #         delete_row(row)
        # except Exception as e:
        #     print(e)

        
        cur.execute("delete from card_audios where user_id = :user_id", {
            'user_id' : args.user_id
        })
        cur.execute("delete from crops where user_id = :user_id", {
            'user_id' : args.user_id
        })
        cur.execute("delete from decoration_images where user_id = :user_id", {
            'user_id' : args.user_id
        })
        cur.execute("delete from greeting_cards where user_id = :user_id", {
            'user_id' : args.user_id
        })
        cur.execute("delete from images where user_id = :user_id", {
            'user_id' : args.user_id
        })
        cur.execute("delete from raws where user_id = :user_id", {
            'user_id' : args.user_id
        })
        cur.execute("delete from sequences where user_id = :user_id", {
            'user_id' : args.user_id
        })

        # delete the user object
        print("Deleting users record for", args.user_id)
        cur.execute('delete from users where user_id = :user_id', {
            'user_id': args.user_id,
        })
        # delete all rows in devices_users linking user to a device
        print("Deleting all records in devices_users for", args.user_id)
        cur.execute('delete from devices_users where user_id = :user_id', {
            'user_id': args.user_id,
        })
        conn.commit()
