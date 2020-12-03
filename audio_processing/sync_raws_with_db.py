'''
cleans out raws and everything within their dir
if they arent in the db
'''
import argparse
import os
import json
import tempfile
import uuid
import glob
from db_queries import cur, conn
import bucket_client as bc
import re


if __name__ == '__main__':
    all_blobs = bc.storage_client.list_blobs(
        bc.BUCKET_NAME, prefix='', delimiter=None
    )
    to_delete = []
    raw_uuids = [row['uuid'] for row in cur.execute('select uuid from raws').fetchall()]
    for blob in all_blobs:
        uuid_check = blob.name.split('/')[0]
        if re.match(r'.{8}-.{4}-.{4}-.{4}-.{12}', uuid_check):
            if uuid_check not in raw_uuids:
                to_delete.append(blob)

    with bc.storage_client.batch():
        for blob in to_delete:
            try:
                blob.delete()
            except:
                print(blob.name, 'failed')
    # this should get only the new backing uuids in the db
    # these are the ones we should keep
    #raw_uuids = set([
    #    row['uuid'] for row in cur.execute('select uuid from raws').fetchall()
    #])
    #with bc.storage_client.batch():
    #    for blob in all_backing_tracks:
    #        uuid = blob.name.split('/')[1]
    #        if uuid not in backing_uuids:
    #            try:
    #                blob.delete()
    #                print('deleted', blob.name)
    #            except:
    #                print(blob.name, 'failed')


