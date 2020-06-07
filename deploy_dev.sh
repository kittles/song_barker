git stash
git pull origin master
if [ "$1" == "q" ]; then
    cd server
    pm2 restart app.js
    discord_webhook_url="https://discordapp.com/api/webhooks/692090733842268221/xVUsUktputk7B7ePZsC3jx9ltlk3ffZ8OwVmSxZagczK0c1htUu-IweCS1JmAsdb3ZXn"
    curl -H "Content-Type: application/json" -X POST -d '{"username": "dev server bot", "content": "\n ********** \n 😎 dEv SeRveR dEPlOyEd 😎 \n ********** \n"}' $discord_webhook_url
else
    cd audio_processing
    source .env/bin/activate
    pip install -r requirements.txt
    deactivate
    cd ../server
    npm install
    pm2 restart app.js
    discord_webhook_url="https://discordapp.com/api/webhooks/692090733842268221/xVUsUktputk7B7ePZsC3jx9ltlk3ffZ8OwVmSxZagczK0c1htUu-IweCS1JmAsdb3ZXn"
    curl -H "Content-Type: application/json" -X POST -d '{"username": "dev server bot", "content": "\n ********** \n 😎 dEv SeRveR dEPlOyEd 😎 \n ********** \n"}' $discord_webhook_url
fi
