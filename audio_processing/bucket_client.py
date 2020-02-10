import os
from google.cloud import storage
from logger import log
from io import BytesIO

BUCKET_NAME = 'song_barker_sequences'

storage_client = storage.Client()


def download_filename_from_bucket (remote_fp, fp):
    # remote_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(remote_fp)
    log('start download_to_filename {}\n'.format(remote_fp))
    blob.download_to_filename(fp)
    log('finish download_to_filename {}\n'.format(remote_fp))


def download_from_bucket (remote_fp):
    # remote_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(remote_fp)
    bytestream = BytesIO()
    log('start download {}\n'.format(remote_fp))
    blob.download_to_file(bytestream)
    log('finish download {}\n'.format(remote_fp))
    return bytestream


def upload_filename_to_bucket (fp, dest_fp):
    # dest_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(dest_fp)
    log('start upload_from_filename {}\n'.format(dest_fp))
    # TODO the file type is text/plain in the bucket... should be audio
    blob.upload_from_filename(fp)
    log('finish upload_from_filename {}\n'.format(dest_fp))


def upload_to_bucket (bytestream, dest_fp):
    # dest_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(dest_fp)
    log('start upload {}\n'.format(dest_fp))
    # TODO the file type is text/plain in the bucket... should be audio
    blob.upload_from_string(data=bytestream.read())
    log('finish upload {}\n'.format(dest_fp))


if __name__ == '__main__':
    bytestream = download_from_bucket('input_audio/sample_woof.wav')
    upload_to_bucket(bytestream, 'input_audio/test_upload_io.wav')
