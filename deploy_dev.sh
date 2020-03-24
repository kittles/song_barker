git stash
git pull origin master
cd server
npm install
cd ../audio_processing
source .env/bin/activate
pip install -r requirements.txt
pm2 restart app.js
discord_webhook_url="https://discordapp.com/api/webhooks/677265855716786196/Gp3WPXSRtR4UivRy6H3_3FXyRNjUvWPceAC0M5mhRJ2DJuHGlerEK2PO9RI7hojpG-sM"
curl -H "Content-Type: application/json" -X POST -d '{"username": "dev server bot", "content": "\n ********** \n 😎 dEv SeRveR dEPlOyEd 😎 \n ********** \n"}' $discord_webhook_url
