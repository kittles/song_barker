import glob
import bucket_client as bc
import os
import pathlib
import tempfile
import db_queries as dbq
import audio_conversion as ac
from midi_bridge import MidiBridge
root_dir = pathlib.Path(__file__).parent.absolute()

# users
dev_user_id = 'dev'
[dbq.db_insert('users', **user) 
    for user in [
        {
            'user_id': dev_user_id,
            'name': 'dev-user',
            'email': 'dev@songbarker.com',
        },
        {
            'user_id': 999,
            'name': 'tovi',
            'email': 'deartovi@gmail.com',
        },
        {
            'user_id': 'Graig',
            'name': 'Graig',
            'email': 'graig@songbarker.com',
        },
        {
            'user_id': 'Jeremy',
            'name': 'Jeremy',
            'email': 'jeremy@songbarker.com',
        },
    ]
]


# raws
for raw_fp in glob.glob(os.path.join(root_dir, 'fixture_assets', 'raws', '*.aac')):
    bucket_dir = raw_fp.split('/')[-1].replace('.aac', '')
    bucket_fp = bucket_dir + '/raw.aac'
    bc.upload_filename_to_bucket(raw_fp, bucket_fp)

    uuid = bucket_dir # just use name of file
    name = bucket_dir.replace('raw-fixture-', '').replace('-', ' ')
    dbq.db_insert('raws', **{
        'uuid': uuid,
        'user_id': dev_user_id,
        'name': name,
        'bucket_url': 'gs://song_barker_sequences/' + bucket_fp,
        'bucket_fp': bucket_fp,
    })

# fake raw file for crop fixtures
# this is so we can have predictable crop uuids
bucket_fp = 'raw-fixture-fake-raw/raw.aac'
raw_fp = os.path.join(root_dir, 'fixture_assets', 'raws', 'raw-fixture-one-two-three.aac')
bc.upload_filename_to_bucket(raw_fp, bucket_fp)
fake_raw_crop_dir = 'raw-fixture-fake-raw/cropped'
dbq.db_insert('raws', **{
    'uuid': 'raw-fixture-fake-raw',
    'user_id': dev_user_id,
    'name': 'fake raw',
    'bucket_url': 'gs://song_barker_sequences/' + bucket_fp,
    'bucket_fp': bucket_fp,
})


# crops - these are all going to the fake raw dir
for crop_fp in glob.glob(os.path.join(root_dir, 'fixture_assets', 'crops', '*.aac')):
    crop_name = crop_fp.split('/')[-1]
    bucket_fp = os.path.join(fake_raw_crop_dir, crop_name)
    bc.upload_filename_to_bucket(crop_fp, bucket_fp)
    dbq.db_insert('crops', **{
        'uuid': crop_name.replace('.aac', ''),
        'raw_id': 'raw-fixture-fake-raw',
        'user_id': dev_user_id, 
        'name': crop_name.replace('.aac', ''),
        'bucket_url': 'gs://song_barker_sequences/' + bucket_fp,
        'bucket_fp': bucket_fp,
        'stream_url': None,
    })


# songs
category_map = {
    'baby_shark.mid':         'Kids',
    'cmin_fugue.mid':         'Classical',
    'crazy.mid':              'Test',
    'for_unit_testing.mid':   'Test',
    'happy_birthday.mid':     'Holiday',
    'sample_midi.mid':        'Test',
    'sweet_child_o_mine.mid': 'Rock',
    'two_track_test.mid':     'Test',
}
backing_track_map = {
    'happy_birthday.mid':                  'happy_birthday', # this is a directory that has the backing track in all keys
    'happy_birthday_tovi.mid':             'happy_birthday',
    'happy_birthday_graig_1_semitone.mid': 'happy_birthday',
    'happy_birthday_graig_3_semitone.mid': 'happy_birthday',
    'no_pitch.mid':                        'happy_birthday',
    'pitched.mid':                         'happy_birthday',
    'semi_pitched.mid':                    'happy_birthday',
}
key_map = {
    'happy_birthday.mid':                  4,
    'happy_birthday_tovi.mid':             4,
    'happy_birthday_graig_1_semitone.mid': 4,
    'happy_birthday_graig_3_semitone.mid': 4,
    'no_pitch.mid':                        4,
    'pitched.mid':                         4,
    'semi_pitched.mid':                    4,
}
with tempfile.TemporaryDirectory() as tmp_dir:
    for midi_fp in glob.glob(os.path.join(root_dir, 'fixture_assets', 'songs', '*.mid')):
        filename = midi_fp.split('/')[-1]
        bucket_fp = 'midi_files/' + filename
        bucket_url = 'gs://song_barker_sequences/midi_files/' + filename
        bc.upload_filename_to_bucket(midi_fp, bucket_fp)

        mb = MidiBridge(midi_fp, tmp_dir, False)
        name = filename.replace('.mid', '');
        name = name.replace('_', ' ');
        name = name.lower()
        dbq.db_insert('songs', **{
            'name': name,
            'bucket_fp': bucket_fp,
            'bucket_url': 'gs://song_barker_sequences/' + bucket_fp,
            'track_count': mb.track_count(),
            'bpm': mb.bpm,
            'price': 0.99,
            'key': key_map.get(filename),
            'category': category_map.get(filename),
            'backing_track': backing_track_map.get(filename),
        })


# upload backing tracks
for backing_fp in glob.glob(os.path.join(root_dir, 'fixture_assets', 'backing_tracks', 'happy_birthday', '*.aac')):
    filename = backing_fp.split('/')[-1]
    bucket_fp = 'backing_tracks/happy_birthday/' + filename
    bc.upload_filename_to_bucket(backing_fp, bucket_fp)



# images
for image_fp in glob.glob(os.path.join(root_dir, 'fixture_assets', 'images', '*')):
    filename = image_fp.split('/')[-1]
    bucket_fp = 'images/' + filename
    bucket_url = 'gs://song_barker_sequences/images/' + filename
    bc.upload_filename_to_bucket(image_fp, bucket_fp)
    dbq.db_insert('images', **{
        'uuid': filename.split('.')[0],
        'user_id': dev_user_id,
        'bucket_fp': bucket_fp,
        'bucket_url': bucket_url,
        'name': 'default ' + filename.split('.')[0],
        'mouth_coordinates': '[(0.452, 0.415), (0.631, 0.334)]',
    })
