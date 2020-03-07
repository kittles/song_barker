import os
from google.cloud import storage
import logger
from io import BytesIO

BUCKET_NAME = 'song_barker_sequences'

log = logger.log_fn(os.path.basename(__file__)) 

storage_client = storage.Client()


def download_filename_from_bucket (remote_fp, fp):
    # remote_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(remote_fp)
    log(remote_fp, 'start download_to_filename')
    blob.download_to_filename(fp)
    log(remote_fp, 'finish download_to_filename')


def download_from_bucket (remote_fp):
    # remote_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(remote_fp)
    bytestream = BytesIO()
    log(remote_fp, 'start download_to_filename')
    blob.download_to_file(bytestream)
    log(remote_fp, 'finish download_to_filename')
    return bytestream


def upload_filename_to_bucket (fp, dest_fp):
    # dest_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(dest_fp)
    log(dest_fp, 'start upload_from_filename')
    # TODO the file type is text/plain in the bucket... should be audio
    blob.upload_from_filename(fp)
    log(dest_fp, 'finish upload_from_filename')


def upload_to_bucket (bytestream, dest_fp):
    # dest_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(dest_fp)
    log(dest_fp, 'start upload_from_filename')
    # TODO the file type is text/plain in the bucket... should be audio
    blob.upload_from_string(data=bytestream.read())
    log(dest_fp, 'finish upload_from_filename')


if __name__ == '__main__':
    bytestream = download_from_bucket('input_audio/sample_woof.wav')
    upload_to_bucket(bytestream, 'input_audio/test_upload_io.wav')
