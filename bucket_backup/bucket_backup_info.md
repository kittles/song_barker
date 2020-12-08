# description
these are google cloud functions that back up the contents of the dev and prod buckets
once a day. they are invoked by a google pub sub call.

for cloud functions see: https://console.cloud.google.com/functions/list?project=songbarker
for cloud scheduler see: https://console.cloud.google.com/cloudscheduler?project=songbarker

each backup is a directory in the backup bucket, and the directory is a timestamp of when
the backup took place.

`deploy.sh` will upload the latest version of the scripts to google cloud

# local testing
the scrips should be runnable locally by creating an python3 env with the requirements in
requirements.txt
