import os
from google.cloud import storage

BUCKET_NAME = os.environ.get('k9_bucket_name', 'song_barker_sequences')

storage_client = storage.Client()


def download_file_from_bucket (remote_fp, fp):
    # remote_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(remote_fp)
    blob.download_to_filename(fp)


def upload_file_to_bucket (fp, dest_fp):
    # dest_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(BUCKET_NAME)
    blob = bucket.blob(dest_fp)
    blob.upload_from_filename(fp)


if __name__ == '__main__':
    print('bucket client will use bucket named:', BUCKET_NAME)
    download_file_from_bucket('play.png', 'local-play.png')
    print('succeeded')
