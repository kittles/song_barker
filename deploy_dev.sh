ssh patrick@165.227.178.14
cd song_barker
git pull origin master
cd server
pm2 restart index.js
exit

