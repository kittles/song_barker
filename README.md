# SoNg bArKeR

## suggested format
maybe it goes like this:
- front end records an audio file
- front end generates uuid for file
- front end sends file to bucket, location is gs://<bucket-name>/<audio-uuid>/raw.wav
- front end tells back end "there is a new audio file at <audio-uuid>"
- back end splits on silence and puts crops in location gs://<bucket-name>/<audio-uuid>/cropped/
- front end tells back end to take a specific crop and make a song out of it, back end puts it at gs://<bucket-name>/<audio-uuid>/songs (with filename 001.wav incrementing as more renders)

## notes
- dont forget to put the credential file on the server or wherever you deploy so that you can get stuff from the buckets
