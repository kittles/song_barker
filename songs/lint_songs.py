import glob
import argparse
import os
import json

d = '.'
song_dirs = [os.path.join(d, o) for o in os.listdir(d) if os.path.isdir(os.path.join(d, o))]
infos = []

for song_dir in song_dirs:
    print('checking {}'.format(song_dir))
    midi_fp = os.path.join(song_dir, 'song.mid')
    info_json_fp = os.path.join(song_dir, 'info.json')

    if not os.path.exists(midi_fp):
        print('---- ERROR: no song.mid')

    if not os.path.exists(info_json_fp):
        print('---- ERROR: no info.json')

    info = json.loads(open(info_json_fp, 'r').read())
    infos.append(info)
    print(json.dumps(info, sort_keys=True, indent=4))

    if not isinstance(info['track_count'], int):
        print('---- ERROR: track_count not an integer')

    if not isinstance(info['bpm'], int):
        print('---- ERROR: bpm not an integer')

    if not isinstance(info['key'], int):
        print('---- ERROR: key not an integer')

    if not isinstance(info['name'], str):
        print('---- ERROR: name not a string')

    if not isinstance(info['category'], str):
        print('---- ERROR: category not a string')

    if not isinstance(info['song_family'], str):
        print('---- ERROR: song_family not a string')

    backing_track_fps = glob.glob(os.path.join(song_dir, '*.aac'))
    print(len(backing_track_fps))
    print('\n'.join(sorted(backing_track_fps)))


print('\nname:')
print('\n'.join(sorted([
    '   - ' + i['name'] for i in infos
])))
print('\ncategory:')
print('\n'.join(sorted([
    '   - ' + i['category'] for i in infos
])))
print('\nsong_family:')
print('\n'.join(sorted([
    '   - ' + i['song_family'] for i in infos
])))
print('\nid:')
print('\n'.join(sorted([
    '   - ' + str(i['id']) for i in infos
])))

