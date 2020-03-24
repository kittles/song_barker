db_file='./barker_database.db'
if test -f "$db_file"; then
    echo "removing old $db_file"
	rm $db_file
fi
node -e "require('./database.js').initialize_db();"
node -e "require('./database.js').fixtures();"
