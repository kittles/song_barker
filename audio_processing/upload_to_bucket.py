from google.cloud import storage


def upload_sequence ():
    """Uploads a file to the bucket."""
    bucket_name = 'song_barker_sequences/sequences'
    source_file_name = 'output/sequences/sequence.wav'
    destination_blob_name = 'sequence-1.wav'

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    blob.upload_from_filename(source_file_name)

    print(
        "File {} uploaded to {}.".format(
            source_file_name, destination_blob_name
        )
    )


if __name__ == '__main__':
    upload_sequence()
