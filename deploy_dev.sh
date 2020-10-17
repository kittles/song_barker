git stash
git pull origin master

# update env and node_modules
if [ "$1" == "u" ]; then
    cd $k9_audio_dir
    source $k9_python_virtual_env
    pip install -r requirements.txt
    deactivate
    cd $k9_server_dir
    npm install
fi

# restart express server
cd $k9_server_dir
pm2 restart app.js
curl -H "Content-Type: application/json" -X POST -d '{"username": "dev server bot", "content": "\n ********** \n 😎 dEv SeRveR dEPlOyEd 😎 \n ********** \n"}' $k9_discord_webhook_url
