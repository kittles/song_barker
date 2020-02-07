from google.cloud import storage
    


def upload_sequence ():
    """Uploads a file to the bucket."""
    bucket_name = 'song_barker_sequences/sequences'
    source_file_name = '/home/patrick/patrick/projects/song_barker/audio_processing/output/sequences/sequence.wav'
    destination_blob_name = 'sequence.wav'

    storage_client = storage.Client.from_service_account_json('../credentials/songbarker-50dfd44f0393.json')
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
