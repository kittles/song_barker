import bucket_client as bc
import os
import sqlite3
import re

if __name__ == '__main__':
    # prune stuff in the bucket that isnt in the db
    # uuid format: 01ab4b83-2603-4ea9-aa59-5cf2a643f713
    #              8       -4   -4   -4   -12                
    conn = sqlite3.connect('../server/barker_database.db')
    cur = conn.cursor()
    cur.execute('select uuid from raws')
    raw_uuids_db = set([i[0] for i in cur.fetchall()])

    blobs = bc.storage_client.list_blobs(bc.BUCKET_NAME)
    raw_uuids_bucket = []
    for blob in blobs:
        root_dirname = blob.name.split('/')[0]
        # if it looks like a uuid keep it
        if re.match(r'.{8}-.{4}-.{4}-.{4}-.{12}', root_dirname):
            raw_uuids_bucket.append(root_dirname)
    raw_uuids_bucket = set(raw_uuids_bucket)
    
    bucket_orphans = raw_uuids_bucket - raw_uuids_db
    db_orphans = raw_uuids_db - raw_uuids_bucket
    print('{} bucket orphans'.format(len(bucket_orphans)))
    print('{} db orphans'.format(len(db_orphans)))
    if input('delete bucket orphans? y/n :') == 'y':
        print('deleting...')
        for uuid in bucket_orphans:
            blobs = bc.storage_client.list_blobs(bc.BUCKET_NAME, prefix=uuid)
            for blob in blobs:
              print('deleting', blob)
              blob.delete()
    else:
        print('not doing anything')



