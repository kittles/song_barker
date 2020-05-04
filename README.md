# *sunglasses emoji guy*

to set up, do something like
```
cd audio_processing
virtualenv -p python3 .env
source .env/bin/activate
pip install -r requirements.txt
deactivate
cd ../server
npm install

```
then, from server dir, call `npm run dev` and it will serve on :3000, watching all files
for changing and refreshing when they do
