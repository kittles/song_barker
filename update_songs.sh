. ./config.sh

# re upload all songs and add them to the db
source $k9_python_virtual_env
cd $k9_audio_dir && python sync_songs_with_db_and_bucket.py
