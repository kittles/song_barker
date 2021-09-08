'''
NOTE: this is mostly useless now that sequencing happens in the cloud

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
import db_queries as dbq
import tempfile


raw_fp = 'one_two_three.wav'


def setup ():
    # convert to aac
    raw_aac_fp = ac.wav_to_aac(raw_fp)

    # generate uuid
    BUCKET_NAME = os.environ.get('k9_bucket_name', 'song_barker_sequences')
    raw_uuid = str(uuid.uuid4())

    # upload the raw file
    bucket_fp = os.path.join(raw_uuid, 'raw.aac')
    print('uploading to bucket at fp: ', bucket_fp)
    bc.upload_filename_to_bucket(raw_aac_fp, bucket_fp)

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
        '1',
    )
    print('calling:', cmd)
    sp.call(cmd, shell=True)

    # need this output somewhere, so that they can be used for the song generation
    # maybe pipe output to a text file


def setup_aac (raw_uuid):
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
        '1',
    )
    print('calling:', cmd)
    sp.call(cmd, shell=True)

    # need this output somewhere, so that they can be used for the song generation
    # maybe pipe output to a text file

'''
{   'bucket_fp': '54aafeaa-82ab-4075-8862-7d9bfe61b0e0/cropped/0c0d162b-d25a-49cd-ae29-a480e9232064.aac',
    'bucket_url': 'gs://song_barker_sequences/54aafeaa-82ab-4075-8862-7d9bfe61b0e0/cropped/0c0d162b-d25a-49cd-ae29-a480e9232064.aac',
    'created': '2020-11-05 21:25:04',
    'crop_type': None,
    'duration_seconds': 0.7671428571428571,
    'hidden': 0,
    'is_stock': 0,
    'name': 'sound 11',
    'raw_id': '54aafeaa-82ab-4075-8862-7d9bfe61b0e0',
    'stream_url': None,
    'user_id': '1',
/tmp/tmpvtatf_ig/crop_003.wav
auto name sound 13
 *** debug output - result from insert *** 
{   'bucket_fp': '54aafeaa-82ab-4075-8862-7d9bfe61b0e0/cropped/52f176cb-9452-429d-a485-1dd909dd4859.aac',
    'bucket_url': 'gs://song_barker_sequences/54aafeaa-82ab-4075-8862-7d9bfe61b0e0/cropped/52f176cb-9452-429d-a485-1dd909dd4859.aac',
    'created': '2020-11-05 21:25:04',
    'crop_type': None,
    'duration_seconds': 0.8198412698412698,
    'hidden': 0,
    'is_stock': 0,
    'name': 'sound 13',
    'raw_id': '54aafeaa-82ab-4075-8862-7d9bfe61b0e0',
    'stream_url': None,
    'user_id': '1',
/tmp/tmpvtatf_ig/crop_006.wav
auto name sound 14
 *** debug output - result from insert *** 
{   'bucket_fp': '54aafeaa-82ab-4075-8862-7d9bfe61b0e0/cropped/ed4f5950-4008-464b-b3e6-03531141082e.aac',
    'bucket_url': 'gs://song_barker_sequences/54aafeaa-82ab-4075-8862-7d9bfe61b0e0/cropped/ed4f5950-4008-464b-b3e6-03531141082e.aac',
    'created': '2020-11-05 21:25:04',
    'crop_type': None,
    'duration_seconds': 1.8947619047619049,
    'hidden': 0,
    'is_stock': 0,
    'name': 'sound 14',
    'raw_id': '54aafeaa-82ab-4075-8862-7d9bfe61b0e0',
    'stream_url': None,
    'user_id': '1',
'''

def examine_crops ():
    crop_uuids = [
        '0c0d162b-d25a-49cd-ae29-a480e9232064',
        '52f176cb-9452-429d-a485-1dd909dd4859',
        'ed4f5950-4008-464b-b3e6-03531141082e',
    ]
    with tempfile.TemporaryDirectory() as tmp_dir:
        crop_objs = [dbq.crop_sampler_from_uuid(crop, tmp_dir) for crop in crop_uuids]
        for co in crop_objs:
            print(co)
            co.play_original()
            co.plot_audio()


def test_songs ():
    crop_uuids = [
        '0c0d162b-d25a-49cd-ae29-a480e9232064',
        '52f176cb-9452-429d-a485-1dd909dd4859',
        'ed4f5950-4008-464b-b3e6-03531141082e',
    ]
    dbq.cur.execute('select id from songs')
    '''
    to_sequence.py args:

    parser.add_argument('--user-id', '-u', help='the user id', type=str)
    parser.add_argument('--song-id', '-s', help='the song id', type=str, default=1)
    parser.add_argument('--crops', '-c', nargs='+', help='crops used for each instrument, in track order')
    parser.add_argument('--debug', '-d', action='store_true', help='playback audio crops', default=False)
    parser.add_argument('--output', '-o', help='output locally', type=str)
    '''
    for row in dbq.cur.fetchall():
        song_id = row['id']
        print(song_id)
        cmd = 'python to_sequence.py -u 1 -s {} -c {} -o test_sequence_output/{}-test.wav -d'.format(
            song_id,
            ' '.join(crop_uuids),
            song_id
        )
        print(cmd)
        sp.call(cmd, shell=True)


if __name__ == '__main__':
    #setup_aac('54aafeaa-82ab-4075-8862-7d9bfe61b0e0')
    test_songs()
    #examine_crops()
