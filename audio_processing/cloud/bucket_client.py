import os
from google.cloud import storage

storage_client = storage.Client()


def download_file_from_bucket (remote_fp, fp, bucket_name):
    # remote_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(remote_fp)
    blob.download_to_filename(fp)


def upload_file_to_bucket (fp, dest_fp, bucket_name):
    # dest_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(dest_fp)
    blob.upload_from_filename(fp)
