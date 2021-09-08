# how to update stock images based on jeremy's account

to use jeremy's account and whatever he has put on there as a source
of stock images, follow these steps:

1. from the /server dir, run sync_with_remote_db.sh to make sure your local db is up to date
2. run sqlite3 <database_name> to connect to your local db
3. within the sqlite3 cli, set the output mode to csv and get jeremys stuff by running the following commands
    - `.mode csv` (set the output to csv)
    - `.output <some path>.csv` (tell sqlite3 where to output the csv to)
    - `select * images where user_id="assmonkey@ribbond.com";` (get all of jeremy's images and output to csv)
4. move and rename the csv output file into the /stock_assets dir and call it `jeremy_dogs.csv` (you will need to delete the old one)
5. to make sure any stuff he deleted from his account is deleted, delete everything in the images dir
6. source the python virtual env in /audio_processing and run `python jeremy_new_images.py`. this will fill the local `stock_assets/images` dir with subdirs for each dog, and put an image and info.json in them
7. commit changes and push to master. probably wise to `git diff` just to see if anything weird happened
8. on dev server, run `./deploy.sh s`, which will update to latest commit, and sync the new stock images with the bucket, as well as update the database to give users the new stock images

