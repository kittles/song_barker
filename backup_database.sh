. $k9_project_root/config.sh

# use gsutil to copy database to bucket
if ! [ -x "$(command -v gsutil)" ]; then
  echo 'Error: gsutil is not installed.' >&2
  exit 1
fi

timestamp=$(python -c "import datetime as dt; print(str(dt.datetime.utcnow()).replace(' ', 'T'))")
gsutil cp $k9_database "gs://"$k9_bucket_name"-dbbackups/$timestamp"

echo "finished backing up database"

# crontab -e and do something like:
# cd /home/patrick/song_barker && . ./config.sh && sh /home/patrick/song_barker/backup_database.sh
