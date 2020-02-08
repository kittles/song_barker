import os
from google.cloud import storage
from logger import log
from io import BytesIO

BUCKET_NAME = 'song_barker_sequences'
TMP_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'tmp')

storage_client = storage.Client()


def download_from_bucket (remote_fp):
    # remote_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(remote_fp)
    bytestream = BytesIO()
    log('start download {}\n'.format(remote_fp))
    blob.download_to_file(bytestream)
    log('finish download {}\n'.format(remote_fp))
    return bytestream


def upload_to_bucket (bytestream, dest_fp):
    # dest_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(dest_fp)
    log('start upload {}\n'.format(dest_fp))
    blob.upload_from_string(data=bytestream.read())
    log('finish upload {}\n'.format(dest_fp))


if __name__ == '__main__':
    bytestream = download_from_bucket('input_audio/sample_woof.wav')
    upload_to_bucket(bytestream, 'input_audio/test_upload_io.wav')
