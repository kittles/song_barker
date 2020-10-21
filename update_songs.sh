. ./config.sh

# delete all song objects in db
sqlite3 $k9_database ".read ./sql_commands/delete_old_song_info.sql"

# re upload all songs and add them to the db
source $k9_python_virtual_env
cd $k9_audio_dir && python add_song.py --all
