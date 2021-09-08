'''
this was used to generate new song directories for adding new songs,
but is out of date
'''
import os
import json
import argparse


parser = argparse.ArgumentParser()
parser.add_argument('--song-dir')
parser.add_argument('--track_count', default=3)
parser.add_argument('--bpm', default=120)
parser.add_argument('--key', default=0)
parser.add_argument('--price', default=0.99)
parser.add_argument('--name', default='SET ME')
parser.add_argument('--category', default='default')
parser.add_argument('--song_family', default='default')
args = parser.parse_args()

info = {
    "track_count": args.track_count,
    "bpm":         args.bpm,
    "key":         args.key,
    "price":       args.price,
    "name":        args.name,
    "category":    args.category,
    "song_family": args.song_family,
}


if os.path.exists(args.song_dir):
    raise Exception('song dir: {} already exists'.format(args.song_dir))

os.mkdir(args.song_dir)
with open(os.path.join(args.song_dir, 'info.json'), 'w') as fh:
    fh.write(json.dumps(info, sort_keys=True, indent=4))
