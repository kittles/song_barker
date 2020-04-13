db_file='./barker_database.db'
if test -f "$db_file"; then
    echo "removing old $db_file"
	rm $db_file
fi
node -e "require('./database.js').initialize_db();"

# set credentials for bucket
export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json"

# call python fixtures script
cd ../audio_processing
source .env/bin/activate
echo "populating fixtures..."
python populate_fixtures.py

if [ $# -eq 0 ]
  then
	echo "notifying discord"
	discord_webhook_url="https://discordapp.com/api/webhooks/692090733842268221/xVUsUktputk7B7ePZsC3jx9ltlk3ffZ8OwVmSxZagczK0c1htUu-IweCS1JmAsdb3ZXn"
	curl -H "Content-Type: application/json" -X POST -d '{"username": "dev server bot", "content": "\n ********** \n 💥 nUkInG thE dEV dB 💥 \n ********** \n"}' $discord_webhook_url
fi
echo "done"
