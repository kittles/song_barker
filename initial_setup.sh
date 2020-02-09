# python env
sudo apt install virtualenv
cd audio_processing
virtualenv -p python3 .env
source .env/bin/activate
pip install -r requirements.txt
cd ..

# initialize database
cd server
node -e 'require("./database.js").initialize_db()'

