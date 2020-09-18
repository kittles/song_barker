# signed urls for uploading

## request and response
from an authenticated session, POST to `/signed-upload-url` with a body that looks like
```json
{
    "filename": "raws/myrawfile.aac",
    "content_type": "audio/mpeg"
}
```
filename should be path relative to the root, which is `gs://song_barker_sequences/`

the server will return a response like
```json
{
    "url": "https://storage.googleapis.com/song_barker_sequences/raws/myrawfile.aac?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=song-barker%40songbarker.iam.gserviceaccount.com%2F20200910%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20200910T193939Z&X-Goog-Expires=901&X-Goog-SignedHeaders=content-type%3Bhost&X-Goog-Signature=63525451b10c3aa6aaf058328d6cbf0ff2cb4b154249e0a18e1b63a72d56394fb928d67b398fdfff4e9c41b0a9ca6c1770958471603b5d162b4c77c9a7d07f7ba13e873c23fae61d3c6303d8e63136d680f6d9cf817e2fd86558cc5eb04dc09eab9058233010dcb02feb0c30636525b5591e5912b906040615b93d81ec79477ce77075f243fbe5553a6b7fb335bd7c931fe5a4ff42a237d7eb68844acbf3bde50a5fa9d66504b16f3ec35249eb7167fa3caf5af0958fec277f8cf1df04c4127658de385bbb72b128e7dcfcaf23b07bc195453222062f3e81e1a2df2eeedae44697a918b1712d1e7c685937e43666df7f5aa311c2874894bdbbc25f3873f84c1c",
    "success": true
}
```

## usage
you should be able to use this url to upload the file to the bucket.
its configured to be viable for 15 minutes since the time of creation.
here is an example of how to use this url, with curl:
`curl -X PUT -H 'Content-Type: audio/mpeg' --upload-file <local_file> <signed url>`

since the bucket has public read permissions, you should be able to remove
the service account credential from the app and use this endpoint for upload,
and public api for reading.

## further reading
google docs on signed urls: https://cloud.google.com/storage/docs/access-control/signed-urls
