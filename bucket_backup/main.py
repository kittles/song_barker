from google.cloud import storage
import datetime as dt


# TODO accept src and dest bucket names
def backup_bucket (src_bucket_name, dest_bucket_name):
    storage_client = storage.Client()

    src_bucket = storage_client.bucket(src_bucket_name)
    dest_bucket = storage_client.bucket(dest_bucket_name)

    all_blobs = list(storage_client.list_blobs(
        src_bucket_name, prefix='', delimiter=None
    ))

    backup_prefix = str(dt.datetime.utcnow()).replace(' ', '-')

    # only 1000 deferred requests allowed at a time
    batch_chunks = []
    idx = 0
    chunk_size = 995
    while idx < len(all_blobs):
        end_idx = min(len(all_blobs), idx + chunk_size)
        new_chunk = all_blobs[idx: end_idx]
        batch_chunks.append(new_chunk)
        idx = end_idx

    for chunk in batch_chunks:
        with storage_client.batch():
            for blob in chunk:
                dest_blob_name = '{}/{}'.format(backup_prefix, blob.name)
                blob_copy = src_bucket.copy_blob(
                    blob, dest_bucket, dest_blob_name
                )
    print('{} -> {} backup finished'.format(src_bucket_name, dest_bucket_name))


def backup_dev (event, context):
    backup_bucket('song_barker_sequences', 'k9-dev-backup')


def backup_prod (event, context):
    backup_bucket('k9karaoke-prod', 'k9-prod-backup')
