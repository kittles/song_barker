'''
expects a directory name in the songs dir
will read the info.json and do the bucket uploading and db insertion
'''
from db_queries import db_insert
import argparse
import os
import json
import tempfile
import uuid
import glob
import bucket_client as bc


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
    parser.add_argument('--song-dirname', '-s', help='the name of the dir within /songs that contains the midi, tracks and info')
    parser.add_argument('--all', action='store_true', default=False)
    parser.add_argument('--debug', '-d', action='store_true', help='dont actually do anything', default=False)
    args = parser.parse_args()


    if args.all:
        d = '../songs'
        song_dirs = [os.path.join(d, o) for o in os.listdir(d) if os.path.isdir(os.path.join(d, o))]
    else:
        song_dirs = [args.song_dirname]

    for song_dir in song_dirs:
        print(song_dir)
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
        print('added to db:', song_dir)
        print('done')
