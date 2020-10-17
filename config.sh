export k9_dev=False
export k9_domain_name="k9karaoke.com"
export k9_ip_address=68.183.113.8
export k9_bucket_name="k9karaoke-bucket"
export k9_project_root="/home/patrick/song_barker"

export k9_credentials_dir=$k9_project_root"/credentials"
export k9_audio_dir=$k9_project_root"/audio_processing"
export k9_server_dir=$k9_project_root"/server"
export k9_database=$k9_server_dir"/barker_database.db"

# this is for bucket upload etc
export GOOGLE_APPLICATION_CREDENTIALS=$k9_credentials_dir"/bucket-credentials.json"

export k9_EMAIL_CREDENTIALS=$k9_credentials_dir"/email.json"
export k9_FACEBOOK_CREDENTIALS=$k9_credentials_dir"/facebook_app_access_token.json"

export k9_python_virtual_env=$k9_audio_dir"/.env/bin/activate"
export k9_discord_webhook_url="https://discordapp.com/api/webhooks/692090733842268221/xVUsUktputk7B7ePZsC3jx9ltlk3ffZ8OwVmSxZagczK0c1htUu-IweCS1JmAsdb3ZXn"
