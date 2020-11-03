'''
meant to inject stuff in the db and call to_sequence.py
to streamline testing and debugging sync and note issues etc

TODO

prep:

record a clip of "one... two... three"

setup()

- upload raws to bucket
    should have a local folder with 3 files
    follow the raw fp convention in the bucket of /uuid/raw.aac

- do some to_crops.py to prepare the crops
    this will create the raw objects too
    need to store the crop uuids somewhere... maybe a csv

test()

- run to_sequence.py with the crops, saving the output to a local file
    need to be able to specify which songs, or all

'''
import bucket_client as bc
import audio_conversion as ac
import uuid
import os
import subprocess as sp


def setup ():
    # convert to aac
    raw_aac_fp = ac.wav_to_aac(raw_fp)

    # generate uuid
    BUCKET_NAME = os.environ.get('k9_bucket_name', 'song_barker_sequences')
    raw_uuid = uuid.uuid4()

    # upload the raw file
    bucket_fp = os.path.join(BUCKET_NAME, raw_uuid, 'raw.aac')
    bucket_client.upload_filename_to_bucket(raw_aac_fp, bucket_fp)

    '''
    to_crops args:
        parser.add_argument('--input-audio-uuid', '-i', help='audio file to be split')
        parser.add_argument('--user-id', '-u', help='user_id')
        parser.add_argument('--image-id', '-m', help='image_id')
        parser.add_argument('--debug', '-d', action='store_true', help='playback audio crops', default=False)
    '''
    # call the to_crops.py script
    cmd = 'python to_crops.py --input-audio-uuid {} --user-id {} --image-id {} -d'.format(
        raw_uuid,
        '1', #TODO real stuff here...
        'some-image-id',
    )
    sp.call(cmd, shell=True)

    # need this output somewhere, so that they can be used for the song generation
    # maybe pipe output to a text file


def test_songs ():
    pass











