export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" # this is bad, but it needs to be relative to audio processing dir

# delete all song objects in db
sqlite3 ./server/barker_database.db ".read ./sql_commands/delete_old_song_info.sql"

# re upload all songs and add them to the db
source ./audio_processing/.env/bin/activate
cd ./audio_processing && python add_song.py --all
