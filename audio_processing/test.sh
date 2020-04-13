export BUCKET_NAME="song_barker_sequences_test"
export DB_FILE="test.db"
python -c "import bucket_client as bc; bc.create_bucket('$BUCKET_NAME')"
cd ../server
rm $DB_FILE 2> /dev/null
node -e "require('./database.js').initialize_db();"
cd ../audio_processing
python populate_fixtures.py
python -c "import bucket_client as bc; bc.delete_bucket('$BUCKET_NAME', True)"
cd ../server
rm $DB_FILE
