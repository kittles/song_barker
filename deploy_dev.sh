git stash
git pull origin master

# update env and node_modules
if [ "$1" == "u" ]; then
    cd /home/patrick/song_barker/audio_processing
    source .env/bin/activate
    pip install -r requirements.txt
    deactivate
    cd /home/patrick/song_barker/server
    npm install
fi

# restart express server
cd /home/patrick/song_barker/server
pm2 restart app.js
discord_webhook_url="https://discordapp.com/api/webhooks/692090733842268221/xVUsUktputk7B7ePZsC3jx9ltlk3ffZ8OwVmSxZagczK0c1htUu-IweCS1JmAsdb3ZXn"
curl -H "Content-Type: application/json" -X POST -d '{"username": "dev server bot", "content": "\n ********** \n 😎 dEv SeRveR dEPlOyEd 😎 \n ********** \n"}' $discord_webhook_url
