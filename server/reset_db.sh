db_file='./barker_database.db'
if test -f "$db_file"; then
    echo "removing old $db_file"
	rm $db_file
fi
node -e "require('./database.js').initialize_db();"
node -e "require('./database.js').fixtures();"

discord_webhook_url="https://discordapp.com/api/webhooks/677265855716786196/Gp3WPXSRtR4UivRy6H3_3FXyRNjUvWPceAC0M5mhRJ2DJuHGlerEK2PO9RI7hojpG-sM"
curl -H "Content-Type: application/json" -X POST -d '{"username": "dev server bot", "content": "\n ********** \n 💥 nUkInG thE dEV dB 💥 \n ********** \n"}' $discord_webhook_url
