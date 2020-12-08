'''
cleans out raws and everything within their dir
if they arent in the db

BE CAREFUL!!!

this should probably only ever run on dev!
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
    if not os.environ.get('k9_dev', False):
        raise Exception('not on dev server, aborting')

    if input('are you sure you want to delete raws with no uuid in the db? [y/n] ') == 'y':
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
