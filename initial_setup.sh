# python
sudo apt-get install python-dev   # for python2.x installs
sudo apt-get install python3-dev  # for python3.x installs

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

