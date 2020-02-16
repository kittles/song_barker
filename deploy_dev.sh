cd song_barker
git pull origin master
cd server
pm2 restart app.js
# TODO notify discord
discord_webhook_url="https://discordapp.com/api/webhooks/677265855716786196/Gp3WPXSRtR4UivRy6H3_3FXyRNjUvWPceAC0M5mhRJ2DJuHGlerEK2PO9RI7hojpG-sM"
curl -H "Content-Type: application/json" -X POST -d '{"username": "dev server bot", "content": "dev server deployed 😎"}' $discord_webhook_url
