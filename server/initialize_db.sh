node -e "require('./database.js').initialize_db();"
node -e "require('./database.js').fixtures();"
