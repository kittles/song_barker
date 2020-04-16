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
            'user_id': 'patrick',
            'name': 'patrick',
            'email': 'pat.w.brooks@gmail.com',
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
songs = [
    {
        "id": 1,
        "name": "3",
        "bucket_url": "gs://song_barker_sequences/midi_files/happy_birthday_graig_1_semitone.mid",
        "bucket_fp": "midi_files/happy_birthday_graig_1_semitone.mid",
        "track_count": 3,
        "bpm": 120,
        "key": 4,
        "price": 0.99,
        "category": "Old",
        "song_family": "Old Happy Birthday",
        "backing_track": "happy_birthday",
        "obj_type": "song"
    },
    {
        "id": 2,
        "name": "track sync",
        "bucket_url": "gs://song_barker_sequences/midi_files/track_sync.mid",
        "bucket_fp": "midi_files/track_sync.mid",
        "track_count": 2,
        "bpm": 120,
        "key": None,
        "price": 0.99,
        "category": None,
        "song_family": None,
        "backing_track": None,
        "obj_type": "song"
    },
    {
        "id": 3,
        "name": "no pitch",
        "bucket_url": "gs://song_barker_sequences/midi_files/no_pitch.mid",
        "bucket_fp": "midi_files/no_pitch.mid",
        "track_count": 3,
        "bpm": 120,
        "key": 4,
        "price": 0.99,
        "category": "Festive",
        "song_family": "Happy Birthday",
        "backing_track": "happy_birthday",
        "obj_type": "song"
    },
    {
        "id": 4,
        "name": "cmin fugue",
        "bucket_url": "gs://song_barker_sequences/midi_files/cmin_fugue.mid",
        "bucket_fp": "midi_files/cmin_fugue.mid",
        "track_count": 3,
        "bpm": 65.000065000065,
        "key": None,
        "price": 0.99,
        "category": "Classical",
        "song_family": "Fugue",
        "backing_track": None,
        "obj_type": "song"
    },
    {
        "id": 5,
        "name": "pitched",
        "bucket_url": "gs://song_barker_sequences/midi_files/pitched.mid",
        "bucket_fp": "midi_files/pitched.mid",
        "track_count": 3,
        "bpm": 120,
        "key": 4,
        "price": 0.99,
        "category": "Festive",
        "song_family": "Happy Birthday",
        "backing_track": "happy_birthday",
        "obj_type": "song"
    },
    {
        "id": 6,
        "name": "semi pitched",
        "bucket_url": "gs://song_barker_sequences/midi_files/semi_pitched.mid",
        "bucket_fp": "midi_files/semi_pitched.mid",
        "track_count": 3,
        "bpm": 120,
        "key": 4,
        "price": 0.99,
        "category": "Festive",
        "song_family": "Happy Birthday",
        "backing_track": "happy_birthday",
        "obj_type": "song"
    },
    {
        "id": 7,
        "name": "7",
        "bucket_url": "gs://song_barker_sequences/midi_files/happy_birthday_tovi.mid",
        "bucket_fp": "midi_files/happy_birthday_tovi.mid",
        "track_count": 3,
        "bpm": 120,
        "key": 4,
        "price": 0.99,
        "category": "Old",
        "song_family": "Old Happy Birthday",
        "backing_track": "happy_birthday",
        "obj_type": "song"
    },
    {
        "id": 8,
        "name": "baby shark",
        "bucket_url": "gs://song_barker_sequences/midi_files/baby_shark.mid",
        "bucket_fp": "midi_files/baby_shark.mid",
        "track_count": 2,
        "bpm": 115.00002875000719,
        "key": None,
        "price": 0.99,
        "category": "Kids",
        "song_family": "Baby Shark",
        "backing_track": None,
        "obj_type": "song"
    },
    {
        "id": 9,
        "name": "9",
        "bucket_url": "gs://song_barker_sequences/midi_files/happy_birthday_graig_3_semitone.mid",
        "bucket_fp": "midi_files/happy_birthday_graig_3_semitone.mid",
        "track_count": 3,
        "bpm": 120,
        "key": 4,
        "price": 0.99,
        "category": "Old",
        "song_family": "Old Happy Birthday",
        "backing_track": "happy_birthday",
        "obj_type": "song"
    },
]
with tempfile.TemporaryDirectory() as tmp_dir:
    for song in songs:
        filename = song['bucket_fp'].split('/')[-1]
        midi_fp = os.path.join('./fixture_assets/songs', filename)

        # just in case the midi files were modified
        bc.upload_filename_to_bucket(midi_fp, bucket_fp)
        mb = MidiBridge(midi_fp, tmp_dir, False)
        song['track_count'] = mb.track_count()
        song['bpm'] = mb.bpm
        del song['obj_type']
        dbq.db_insert('songs', **song)


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
