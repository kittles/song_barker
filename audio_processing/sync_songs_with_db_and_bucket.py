'''
expects a directory name in the songs dir
will read the info.json and do the bucket uploading and db insertion
'''
import argparse
import os
import json
import tempfile
import uuid
import glob
from db_queries import cur, conn
import bucket_client as bc


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
        # dont commit so there is continuity
    except Exception as e:
        return None


key_map = {
    'c':  0,
    'db': 1,
    'c#': 1,
    'd':  2,
    'd#': 3,
    'eb': 3,
    'e':  4,
    'e#': 5,
    'f':  5,
    'f#': 6,
    'gb': 6,
    'g':  7,
    'g#': 8,
    'ab': 8,
    'a':  9,
    'a#': 10,
    'bb': 10,
    'b':  11,
    'cb': 11,
}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--debug', '-d', action='store_true', help='dont actually do anything', default=False)
    args = parser.parse_args()

    root_dir = os.path.dirname(os.path.abspath(__file__))
    song_base_dir = os.path.join(root_dir, '..', 'songs')
    song_dirs = [
        os.path.join(song_base_dir, o)
        for o in os.listdir(song_base_dir)
        if os.path.isdir(os.path.join(song_base_dir, o))
    ]
    if args.debug:
        for d in song_dirs:
            print(d)


    # delete old song rows
    cur.execute('delete from songs');

    # make new song rows
    for song_dir in song_dirs:
        info_fp = os.path.join(song_dir, 'info.json')
        midi_fp = os.path.join(song_dir, 'song.mid')
        backing_track_fps = glob.glob(os.path.join(song_dir, '*.aac'))

        with open(info_fp, 'r') as json_fh:
            song_info = json.loads(json_fh.read())

        backing_uuid = str(uuid.uuid4())
        midi_uuid = str(uuid.uuid4())

        remote_backing_dir = 'backing_tracks/{}'.format(backing_uuid)
        remote_midi_fp = 'midi_files/{}.mid'.format(midi_uuid)
        remote_midi_url = os.path.join('gs://', bc.BUCKET_NAME, remote_midi_fp)

        # set the info on the info object
        song_info['bucket_url'] = remote_midi_url
        song_info['bucket_fp'] = remote_midi_fp
        song_info['backing_track'] = backing_uuid

        if args.debug:
            print(json.dumps(song_info, sort_keys=True, indent=4))

        # upload midi file
        bc.upload_filename_to_bucket(midi_fp, remote_midi_fp)

        # upload backing tracks
        for backing_fp in backing_track_fps:
            backing_name = backing_fp.split('/')[-1].replace('.aac', '')
            backing_name = key_map.get(backing_name.lower(), 0)
            remote_backing_fp = os.path.join(remote_backing_dir, '{}.aac'.format(backing_name))
            bc.upload_filename_to_bucket(backing_fp, remote_backing_fp)
            print('uploaded', remote_backing_fp)

        db_insert('songs', **song_info)

    # delete the old songs and add the new ones
    conn.commit()

    # delete old stuff from bucket
    """Lists all the blobs in the bucket that begin with the prefix.

    This can be used to list all blobs in a "folder", e.g. "public/".

    The delimiter argument can be used to restrict the results to only the
    "files" in the given "folder". Without the delimiter, the entire tree under
    the prefix is returned. For example, given these blobs:

        a/1.txt
        a/b/2.txt

    If you just specify prefix = 'a', you'll get back:

        a/1.txt
        a/b/2.txt

    However, if you specify prefix='a' and delimiter='/', you'll get back:

        a/1.txt

    Additionally, the same request will return blobs.prefixes populated with:

        a/b/
    """
    all_backing_tracks = bc.storage_client.list_blobs(
        bc.BUCKET_NAME, prefix='backing_tracks', delimiter=None
    )
    old_backing_uuids = set([
        bt.name.split('/')[1] for bt in all_backing_tracks
    ])
    # this should get only the new backing uuids in the db
    backing_uuids = set([
        row['backing_track'] for row in cur.execute('select backing_track from songs').fetchall()
    ])
    old_backing_uuids.difference_update(backing_uuids)
    bucket = bc.storage_client.bucket(bc.BUCKET_NAME)
    for to_remove_uuid in old_backing_uuids:
        blob_name = 'gs://{}/backing_tracks/{}/*.aac'.format(bc.BUCKET_NAME, to_remove_uuid)
        blob = bucket.blob(blob_name)
        blob.delete()

