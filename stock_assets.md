# stock assets
at some point it became necessary to prepopulate user accounts with
stock dogs and crops. this lets users play around making cards without having to
upload a new picture of make new sounds. the stock assets are in 
`/stock_assets/barks` and `/stock_assets/images`, and there are some scripts to
help manage them in the `/stock_assets` dir.

## stock format
- for images, there is jpg file, and an `info.json` which has
the necessary information about the image, like feature location, name etc needed for the db
- for barks, there is a aac file, and an `info.json` which has the
information about the bark needed for the db

## syncing stock assets to bucket
before users can have the stock objects, they need to be available in the bucket.
`/stock_assets/sync_stock_to_bucket.py` will look in the barks and images directories
and make sure everything gets uploaded to the bucket. it should be as simple as running
the script to make sure everything is in the bucket.


## adding stock objects for a user
when a new account is created, and confirmed, the server will run `/stock_assets/add_stock_objects_to_user.py`
in a subprocess. its a script that expect a user id as an argument, and all it does is put
rows in the database for each stock object for that user. 

## migrating stock for users
when the stock objects change, and you want all existing user's stock objects to change as well,
run `/stock_assets/update_stock_for_users.py` and it will update the db rows for all users
stock objects. it occurs to me writing this right now that this could potentially break cards
that users have generated if you are deleting images. so id recommend only adding images and
crops.

## other scripts
there are a couple other scripts in the `/stock_assets` dir that i made for turning stuff that
jeremy had on his personal account into stock objects. you may need to do that again at some point
so those might be helpful.

