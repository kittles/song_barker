# table of contents
- [overview](#overview)
- [back end endpoints](#back-end-endpoints)
a list of all the public endpoints the back end server exposes
- [local testing back end](#local-testing-back-end)
how to get things up and running on your local machine
- [local testing cluster](#local-testing-cluster)
how to get the docker container running on your local machine
- [models](#models)
a list of the primary abstractions (corresponding to tables) used by the app
- [stock assets](#stock-assets)
a discussion about the dog images and sounds that come with each new account
- [songs](#songs)
a discussion about the function of songs and their structure
- [how to deploy](#how-to-deploy)
how to deploy new versions of the back end and cluster
- [server setup notes](#server-setup-notes)
a play by play of how i set up the digital ocean servers
- [load testing](#load-testing)
- [authorization guide](#authorization-guide)
a walkthrough of how authorization / authentication is handled on the back end
- [signed urls notes](#signed-urls-notes)
more detail on how the app works with the back end to upload files to the bucket
- [cloud endpoint details](#cloud-endpoint-details)
more details on how the cloud endpoints work, and how they communicate with the server
- [how crops are made](#how-crops-are-made)
a discussion of the basic process for extracting crops from raw audio files
- [how sequences are made](#how-sequences-are-made)
a discussion of how crops and a midi file are used to generate a sequence
- [peripheral tooling](#peripheral-tooling)
list of stuff to monitor server etc, backups and other housekeeping
- [puppet](#puppet)
all about the puppet, and the page that shows the cards
- [database migrations](#database-migrations)
how to update the database when you want to change model attributes
- [next steps](#next-steps)
things that need to be done, improved, fixed etc


# overview
this codebase consists of several components:

- a web server that
provides a back end for the mobile app,
serves user generated cards over the internet, and
provides javascript for the mobile app to use for puppet animation.
- a dockerized web server that is deployed as a cluster that handles
cpu intensive audio processing tasks. this server only receives
requests from the first server.
- static assets that the app requires for song generation and user
stock images and crops
- lots of scripts to do lots of little tasks, mostly related to
keeping things in sync between the bucket and the database.

## key terms

- **the back end**:
this is the first web server mentioned

- **the cluster**:
this is the second thing mentioned

- **the bucket**:
this is a google cloud services bucket where static assets are made accessible
to the app

- **stock assets**:
these are things that the user's account is pre populated with
when they first create their account. its just dog images and dog barks.

- **raw**:
this is what i call the raw audio that a user records, before it has
been chopped into usable pieces

- **crop**:
this is what i call a piece of the raw audio file, after it has been
processed. its generally a discrete sound, or in the case of medium
and long crops, a sound with a decent start and ending. i think tovi
and jeremy call them "barks"

- **sequence**:
this is what i call the thing that results when you map a set of crops
to a melody and generate the audio file.

- **greeting card / card**:
this is the thing you actually share with other people, generated by the app

- **puppet**:
this is what i call the three.js scene with (typically) a dog that can
be animated. you can control it kind of like a puppet, hence the name.


## basic architecture

### back end
there are two deployements hosted on digital ocean, a dev and production.
in both cases, the basic deployment looks like an ubuntu 20.04 os
running a nginx server which proxies to an express server, whose process
is managed by pm2. persistence is handled with a sqlite database.

### cluster
the cluster is a docker container. inside, there is a bare bones express server.
the container is uploaded to google cloud services and cluster-ized with kubernetes.


# back end endpoints

## REST api
the first category of endpoints are basically CRUD operations. they are automatically
generated based on the contents of `/server/models.js`, which is roughly a schema of
the database as well as some rules about object permissions (see [models](#models) for more info).
for each object, some subset of the following are made available:
- GET `/get/<object_type>/<pk>`: return json representing the object
- GET `/all/<object_type>`: return an array of all objects belonging to the requester
- POST `/<object_type>`: send a json object here to create it in the db
- PATCH `/<object_type>/<pk>`: update the object with whatever attributes you include in a json object
- DELETE `/<object_type>/<pk>`: delete the object (this may not actually delete it, just set it to hidden)

## accounts
the second category of endpoints are for user account creation.
see [authorization guide](#authorization-guide) for more info on how this flow works.

- POST `/openid-token/<platform>`: send openid token here to log in. i think this is
only used for google tokens, because there is a seperate `/facebook-token` endpoint, but i can't
remember. platform should be one of `"android"` or `"ios"`. i think tovi is sending the token
as the whole request's body.

- POST `/facebook-token`: send a facebook token here to log in. this endpoint will look for the
token as an attribute of the request's body named `"facebook_token"`

these are some openid endpoints that i think google wants you to have. i am not sure
how stringent they are but it would probably be good to get some actual copy here

- GET `/openid-home`

- GET `/openid-privacy`

- GET `/openid-tos`

for manual account generation, these are the relevant apis:

- POST `/manual-login`: log in a user via email and password combo.
expects body params: `email`, `password`

- POST `/create-account`: create a user account and log them in.
expects body params: `email`, `password`

- GET `/email-available/:email`: check if an email is available. you can use this to provide feedback to user, before actually
trying to create the account (which will also check for availability)

- POST `/change-password`: change currently logged in user's password.
expects body params: `old_password` this needs to match for the request to success,
`new_password` whatever man

- POST `/temp-password`: sets the users password to a autogenerated password and emails it to them.
expects body params: `user_id` (this is most likely an email)

- GET `/confirm/<uuid>`: confirms an account

- GET `/agree-to-terms`: agrees to terms for requesters account

- GET`/is-logged-in`: returns a json object with info about session state

- GET `/logout`: disassociates session from user account, which is the same thing as logging them out

- POST `/delete-account`: deletes the account assocated with the request.

## card sharing
these are for sharing links to cards the users have generated

- POST `/to_card_key`: generate a card key for sharing card. expects body params `card_uuid`, `recipient`,
and `has_envelope`

- GET `/c/<card_key>`: returns a web page with the card (this is what people will see when they follow
the link someone has shared)

## custom client app endpoints
these are for the other tasks the client app needs to do

- POST `/signed-upload-url`: get a signed url so client can upload file to bucket.
expects body params `filepath` and `content_type`

- POST `/cloud/to_crops`: generate crops from a raw audio file.
expects body params `uuid` and `image_id`. the image is used for naming crops, and is optional

- POST `/cloud/to_sequence`: generate a sequence from some crops.
expects body params `uuids` (an array) and `song_id`

- GET `/`: the landing page for the website.

- GET `/describe`: shows the contents of `/server/models.js`.
this was just an adhoc way of documenting the object models, its only on dev

# local testing back end
ill try to outline the process of running the back end. i develop on ubuntu,
and found it was mostly frictionless to use os x, but i figure its good
to be aware in case there are some subtle os specific issues that crop up.
getting the back end running locally is probably the first thing you'll
want to do to get acquainted with the repo.

## getting started
run `git clone https://github.com/kittles/song_barker.git`

install the system-wide dependencies:
```
sudo apt-get install python-dev
sudo apt-get install python3-dev
sudo apt install rubberband
sudo apt install sox
sudo apt install nodejs
sudo apt install virtualenv
```
i also recommend installing the sqlite3 cli for mucking around with the db.
im pretty sure you will need gsutil as well.
here is a page for installing that: https://cloud.google.com/storage/docs/gsutil_install

once you've downloaded the repo, you'll need to set up a python3
virtual environment to install the python dependencies. here is a
sample command for doing so, from the project root:
```
cd audio_processing
virtualenv -p python3 .env
source .env/bin/activate
pip install -r requirements.txt
```
this will create a python virtualenv in the `/audio_processing` dir, and
install the requirements as specified in the requirements.txt there. note that
the config (discussed further down) expects a python env called `.env`.

for the server's dependencies, go to `/server` and run `npm install`.
this should grab all the js dependencies.

## credentials
the `/credentials` dir is empty on the repo because its meant to store sensitive info
that doesnt belong in version control. i can give you the necessary files through other
means. but, its probably handy to document what *should* be there:

- `bucket-credentials.json` (this lets the server talk to the bucket)
- `cloud-access-token.json` (this is a *HIGHLY SECURE* token that the server uses when
talking to the cluster)
- `email.json` (this holds the credentials for the account used to send signup emails and the like)
- `facebook_app_access_token.json` (for facebook openid)

## environment variables
there are a number of environment varibles that need to be set in the current shell context
in order to run the server. my solution is to have a set of scripts that live in a different
repo [song_barker_config](https://github.com/kittles/song_barker_config) and to symbolically
link the desired config file to `/config.sh` in the song_barker repo.
then, to put the env
vars into the current context, from song_barker root run `. ./config.sh`. youll need make new
files because things like the project_root will be different on your local machine.

check what everything is set to with `./check_env.sh`.

you should always have your env vars set when running any scripts, since they almost all
depend on at least one env var.

## init the database
you can just clone the database on the dev server. i do this with a script
called `server/sync_with_remote_db.sh`, which will require access to the server obviously. i
recommend this. it will just put a copy of the sqlite db file right there in the server directory.
sqlite3 is useful for looking at the db's contents.

alternatively, from `/server`, run `./initialize_db.sh`. it should create a sqlite db in that directory, whose
name will have been determined from the aformentioned environment variables. you will have an
empty database, and you'll have to run some scripts to populate it with stock objects and songs.


## running the server
cd to `/server` and run `npm run dev`. you should see a bit of info about the current
env vars, and then a log of requests. id suggest you try going to a page in the browser,
something like `http://localhost:3000/all/song` and see if you get anything.

hopefully that all worked, but its very likely that ive missed some initialization step, so please
ask me if you are running into anything that is confusing (and it would be good to add to this
page anything you run into)

here are my guesses if something isnt working:
- you are missing something in `/credentials`
- you havent installed the python or more likely the node requirements
- there is no database file

# local testing cluster

## testing individual scripts
you can run the python scripts in `/audio_processing/cloud` on their own, and they should be designed to be fairly modular in that
way. just make sure you create a `./cloud-env` virtual environment and install the requirements, and 
activate that environment when testing, with `source .cloud-env/bin/activate` (on linux).

## testing the docker container
but often youll need to test the actual docker container, and the server within, before deploying it to the cluster.
i honestly never remember docker command flags and format so i just wrote a bunch of short
shell scripts. you should really only consider them a reference, they are in various states of
working / usefulness. in any case, i would `./build_container.sh`
and then `./run_container.sh`. there are a few `test_to_*` scripts there that are just cURLs to the local or remote container.
make sure you comment or uncomment the appropriate cURL before running them. also, they depend on stuff being in the bucket, so
make sure a file with the corresponding uuid is in fact actually in the bucket.

# models
these are the core abstractions that basically correspond to database tables.

## models.json
this is a json file that describes the attributes (columns)
of each "object", as well as their visibility via the REST api.
found at `/server/models.json`.
each entry has a number of attributes:
- `table_name`: this is what the table is actually named in the sqlite db
- `obj_type`: this is included in REST responses so the client can introspect objects simply
- `primary_key`: this indicates which column operates (formally or informally) as the primary key
- `primary_key_is_uuid`: this is to help with request validation, so the rest api knows whether to check for uuid validity when handling incomming requests
- `user_owned`: whether or not this object is associated with a user account. if true, this will restrict access to the object to only sessions that have been authenticated as the corresponding user
- `immutable`: setting this to true will make the REST api automatically reject any modifications to the object.
- `disable_all`: when true, prevent the `/all/<object_type>` from returning info for this type
- `disable_rest`: when true, disable all REST endpoints for this object

## uuids and bucket objects
many objects have attributes that are urls to objects in a bucket. i have adopted the convention
of naming the files in the bucket with uuids. i did this to avoid naming collisions and so that i can just make the bucket public,
since the entropy of uuids is so high. given the low stakes nature of the stuff stored in the bucket,
i havent gone to too much trouble to challenge this assumption, but it might be something to keep in mind.

## random notes
- the `stream_url` attribute is deprecated.
- the `user_id` attribute is generally used to determine ownership and permissions for an object.
- the `*_url` and `*_fp` are redundant, it was a bad decision to include both.
- the `desc` attribute on each column def is just there for reference. the whole schema
is served by the webserver at `localhost:3000/describe` as a handy reference. originally intended
in lieu of better REST documentation.
- i cannot remember if i was careless enough to write a sql expression that depends on the order
rather than column name, but just in case id recommend against reordering the columns in the schema.
instead just add new ones at the bottom of the array.


## individual models

### user
the user object is hopefully self explanitory.
the primary purpose of having a user object at all is to track purchases and enable a single account accross
multiple devices.

### raw
the raw object is a raw audio file, the thing a user records that will subsequently be
cropped into little pieces. uuid, which is the primary key for the object in the db, will
also be the name of the directory on the bucket where the actual audio file resides, and 
the file itself with be named raw.aac. this is a clumsy holdover from an early arrangment.
if i were to redesign this, id completely flatten the dir structure on the bucket (since
its already like that behind the scenes anyway) and just connect everything with a uuid.

### crop
i use "crop" because it is generic, but everyone calls them "barks". its a single audio
event generally cropped from a raw file. like a single bark plucked from a raw audio file thats
lots of barks and silences. these are the things you are selecting when you are picking
a short, medium and long sound in the app. generated by the `/cloud/to_crops` endpoint

### sequence
this is the musical sequence that is generated by mapping the crops to pitches. it does not
include the backing track in the actual audio, just the mapped crops. generated by the `/cloud/to_sequence` endpoint

### song
the song object is a conglomeration of info need for building the musical sequences
from audio crops. in the bucket, there is a directory with a midi file and 12 backing tracks (one for each key).
there is metadata about the song stored on this object which makes life a little easier for the 
front end and then cloud. these objects get populated in the db with a special script, because
they need to correspond to things in the bucket and it all needs to stay in sync.

### image
this is the (probably) image of a dog face. in addition to storing the basic info about the image,
there are a number of json-like fields for storing settings for how to animate the dog. these
are evaled by the front end so they need to be valid js. this image is what puppet.js uses on the
3d mesh. 

### decoration_image
this is a transparent png that gets overlayed on top of the puppet when sharing the card.
it is optional, and can vary in dimension, depending on whether there is a frame. hence
the `has_frame_dimension` attribute (important for layout on the web front end)

### card_audio
when people want to share a card, 
Tovi generates a mix of the sequence and a backing track, as well as an optional greeting message.
he uploads it to the bucket, and also lets the server know, which will make an entry in this table.

### greeting_card
this was initially conceived of as the single point for all the relevant info for a card that is
going to be shared. it holds most of the information the web front end will need to render a card.
i think the atttributes that are duplicated by card_key are ignored, and the ones on card_key used instead.

### card_key
when the use decides to share a card, there is a little interchange between the client and server
to create one of these. they allow for shorter, prettier urls for sharing. they also allow for different
recipients to receive the same card (i.e. multiple card_keys can point to the same greeting_card)

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

# songs
the `songs/` dir holds the information and audio for the backing tracks that go with the user
generated sequences.

there are a number of distinct things that youll need to do with songs.
most frequently, you will need to update / synchronize the songs with
whatever changes have been made by jeremy or whoever. this can be adding new songs,
changing the info for a song, changing the audio file for a song, etc. i will
describe the process for doing those things here, but first ill give a basic description of
a single song within the `/songs` dir.

## a single song directory structure
within a single song directory, there must be the following:
- `info.json`: a file that contains metadata about the song
- `song.mid`: a midi file that is used by the back end and cloud to generate sequences
- 12 aac files, named for the key they are in (use only sharps, not flats). these are backing tracks
that go with the generated sequence.

## song backing tracks
there are a couple things to remember about song backing tracks:

- they are aac files, and when converting to wav (or whatever) and then reencoding as aac, there will be a little
bit of extra silence added to the beginning. this is apparently part of the aac spec and is not a
bug with ffmpeg. make sure when you are reencoding things that you use code that is aware of this.
ive written some functions that do their best to undo the offset reencoding introduces- specifically the 
`wav_to_aac_no_offset` function in `audio_processing/audio_conversion.py`.
- make sure songs are homogenous in perceived loudness, samplerate and channel count. not just within
a directory, but across all songs. i think we currently use 44000 sample rate, mono, and i processed
the backing tracks with a perceptual loudness meter to get them even. there may be some scripts in
varying degrees of readiness for these kinds of tasks.

## the midi file
though you probably wont be writing midi tracks yourself, here are some guidelines just for reference:

be sure to set the midi file to the correct bpm (it defaults to 120 often, but you should always set it explicitly)
if you are editing in a daw with the audio track as a reference, make sure the midi events will
be happening at the correct time (daw specific, but possible that the "midi region" or track length etc could offset the midi timing).
this might include making the midi region start at the same place as the audio track.
use midi tracks (not channels) to differentiate between sounds- the back end will assign one sound per track.
prefix the track name with `nopitch_` if you want the back end not to alter the pitch of the sound its using for that track.
prefix the track name with `relativepitch_` if you want the back end to shift the pitch of the sound based on the midi track, without transposing the sound to the midi pitch first.
quantizng midi event durations will save the server from having to recompute stuff, so do that as much as you can.

## syncing songs
to update song backing tracks or add new songs, run `audio_processing/sync_songs_with_db_and_bucket.py`.
it will upload the backing tracks and info and midi file, essentially overwriting whatever was
in the bucket already for that song. remember that your local server and the dev server use the same
bucket, so if you run this on your local machine, without then running it on the dev server,
you will confuse the dev server potentially. in general,
i try to work as much as possible by cloning the dev db to my local computer.

# how to deploy
the deployment process is different for the dev and prod server currently.
ill walk through the process for each, and then the cluster at the bottom

## development
the dev server is at `165.227.178.14`, deployed on digital ocean
its accessible via https at https://thedogbarksthesong.ml (NOTE the non traditional tld)
the dev server uses the `master` branch of the repo

ssh to the server and in the home dir there is a script called `deploy.sh`.
it should be fairly obvious from reading it what happens, but just to summarize:

it stashes whatever changes have been made locally (which there should really never be any)
then pulls the latest `master` from github

if you passed a `u` it will then make sure the python and node requirements are up to date

if you passed an `s` it will sync songs and stock assets (see songs.md and stock_assets.md for what is actually happening)

it then restarts the app, through a process manager called `pm2`
and it notifies the discord dev channel.

## production
the production server is at `68.183.113.8`, deployed on digital ocean
its accessible via https at https://k-9karaoke.com
the prod server uses the `prod` branch of the repo

the `deploy.sh` there runs in pretty much the same fashion, but consult the script itself
for actual details.

## cluster
the cluster is a kubernetes cluster on google cloud services.
its accessible via http at `http://34.83.134.37`
the whole thing is dockerized, so you can consult the Dockefile
to get a sense of what the actual server architecture is (see "the cluster" section), but succinctly,
use `./build_container.sh` to build a new container, then
you update the version number in `/audio_processing/cloud/update_app.sh`
and then run that script. it will push the new docker image, and
then tell the cluster to use that.

im not very familiar with cluster orchestration or the google
infrastructure, and id guess that there are simpler ways of doing this. in any case, you can
watch the output until you see the cluster has new containers.

# server setup notes
when setting up the prod server, which is mostly the same as the dev server, i made a list
of notes of the steps i took, which may be helpful:

### initial setup
follow: https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu-20-04

- created user "patrick"
- UFW firewall

### nginx setup
follow: https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-20-04

- using /etc/nginx/sites-enabled/default
- server logs are at:
    - /var/log/nginx/access.log: Every request to your web server is recorded in this log file unless Nginx is configured to do otherwise.
    - /var/log/nginx/error.log: Any Nginx errors will be recorded in this log.


### ssl encryption for nginx
follow: https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04

- email used was: turboblasterllc@gmail.com

### DNS from namecheap to digital ocean
https://www.digitalocean.com/community/tutorials/how-to-point-to-digitalocean-nameservers-from-common-domain-registrars

### DNS records setup on digital ocean
https://www.digitalocean.com/docs/networking/dns/how-to/manage-records/

- A records for k-9karaoke.com and www.k-9karaoke.com

### set up node
follow https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04

# load testing
i have a very rudimentary set up to load test endpoints.
to do so, from the `/load_testing` dir,
run `locust` (with the audio processing python env activated) and go to `http://0.0.0.0:8089/`
to use the web interface

`/load_testing/locustfile.py` is where you can specify tasks for it to run

this is useful to get a rough sense of how many concurrent users an endpoint or
deployment can handle.

# authorization guide

## overview
the server uses sessions. a user is "logged in" if `session.user_id` attribute is set on their session, and there is an entry for that user in the db.
you can check this with a get request to `/is-logged-in`.
to log in, the client will, by some means, get an openid token and post it to the server's endpoint at `/openid-token`.
the server sends this token to a 3rd party server, and uses the information that comes back (assuming its valid) to try to retrieve the user object
from the database.
if there isn't a user object already, the server creates one.
it then sets `session.user_id` to the user_id in the database object.


## client session cookie
the client should expect a `Set-Cookie` header coming backing from the server, to establish a session cookie.
the cookie will look something like
```
connect.sid=s%3AVU376MxSd_Ayt3imNndlY4lZGX8SwCMK.iS77jRVANlhvdLR8t6ns50k0Sfk%2BS4KDouAaS2mHV8s; Path=/; Expires=Thu, 18 Jun 2020 19:19:38 GMT; HttpOnly
```
the .sid variable is the session id that the server uses to pull up the session on the server side.
the client needs to make sure that requests to the server include a `Cookie` header with `connect.sid=s%3AVU376MxSd_Ayt3imNndlY4lZGX8SwCMK.iS77jRVANlhvdLR8t6ns50k0Sfk%2BS4KDouAaS2mHV8s` as the value,
to use the current example.
to summarize- the server sends a cookie with a session id, and the client needs to hold on to that and include it in all subsequent requests to the server as a cookie.
the client never has access to the session, just the session id.

i dont know which dart libraries are good for handling cookies, but i would expect there are some http request libraries that should handle setting cookies automatically. either way, its good
to know whats going on.


## client log in
the first time a user uses the app, they wont be logged in. the client needs to use an oauth2 library to make a requests to a 3rd party server for a token.
here is what i used to do the client->3rd party->client->server auth flow:
```dart
import 'package:openid_client/openid_client_io.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:http/http.dart' as http;

authenticate (String clientId, List<String> scopes) async {
    // create the client
    var issuer = await Issuer.discover(Issuer.google);
    var client = new Client(issuer, clientId);

    // create a function to open a browser with an url
    urlLauncher(String url) async {
        if (await canLaunch(url)) {
          await launch(url, forceWebView: false);
        } else {
          throw 'Could not launch $url';
        }
    }

    // create an authenticator
    var authenticator = new Authenticator(
        client,
        scopes: scopes,
        port: 4000,
        urlLancher: urlLauncher
    );

    // starts the authentication
    var c = await authenticator.authorize();

    // close the webview when finished
    closeWebView();

    // return token for server
    return await c.getTokenResponse();

}
```
the function above can be used like below:
```dart
    // inside some auth flow function

    var client_id = '<platform specific client id>';
    var token = await authenticate(client_id, ['email', 'openid', 'profile']);

    var response = await http.post(
        '<server ip>/openid-token',
        body: json.encode(token),
        headers: {
            'Content-type': 'application/json',
            'Accept': 'application/json',
        }
    );
```

`client_id` is the id oauth2 credential that comes from a 3rd party when i set this up. it will depend on which
third party (google, facebook, etc) is used. currently, there are just two, both for google:

* ios_client_id: `885484185769-b78ks9n5vlka0enrl33p6hkmahhg5o7i.apps.googleusercontent.com`
* android_client_id: `885484185769-05vl2rnlup9a9hdkrs78ao1jvmn1804t.apps.googleusercontent.com`

the `authenticate` function accepts an array of scopes as well. id just pass the three in the example above.
when called, `authenticate` will open a browser (webviews are apparently deprecated for doing oauth now) where the user
can choose their google account and accept the request for information. assuming they do so, `authenticate` will
return a token which can then be sent to the server in a post request like the example above. a 200 from the endpoint `/openid-token`
means that the user is now logged in, and, if necessary, their user object has been created in the database.

i used the [openid_client](https://pub.dev/packages/openid_client) library in the above example


## rest api
the rest api no longer expects user_id's in the url- any time a user_id is needed it comes from the session.
any resources that are user_owned require a valid user_id to query. permissions are also determined by user_id-
a request to modify or get some resource that is owned by a different user than the one on session.user_id is rejected.


## audio api's
`/to_crops` and `/to_sequence` no longer expect a user_id in the body. it will be inferred from the session. requests
that try to use resources not owned by the session.user_id will be rejected.


## recommended flow
just off the dome, id guess a good way of handling auth would be the following:
* on app startup, check `/is-logged-in`, which will establish a session, and tell you if you need to do the oauth flow
* if logged in, you are good, and nothing needs to be done- just include the session cookie in all requests
* if you arent logged in- follow the steps in the client login section above

NOTE it may be helpful to log out for testing- a get request to `/logout` will log the user out (unset the user_id on the session)

# signed urls notes

## request and response
from an authenticated session, POST to `/signed-upload-url` with a body that looks like
```json
{
    "filepath": "raws/myrawfile.aac",
    "content_type": "audio/mpeg"
}
```
filepath should be path relative to the root, which is `gs://song_barker_sequences/`

the server will return a response like
```json
{
    "url": "https://storage.googleapis.com/song_barker_sequences/raws/myrawfile.aac?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=song-barker%40songbarker.iam.gserviceaccount.com%2F20200910%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20200910T193939Z&X-Goog-Expires=901&X-Goog-SignedHeaders=content-type%3Bhost&X-Goog-Signature=63525451b10c3aa6aaf058328d6cbf0ff2cb4b154249e0a18e1b63a72d56394fb928d67b398fdfff4e9c41b0a9ca6c1770958471603b5d162b4c77c9a7d07f7ba13e873c23fae61d3c6303d8e63136d680f6d9cf817e2fd86558cc5eb04dc09eab9058233010dcb02feb0c30636525b5591e5912b906040615b93d81ec79477ce77075f243fbe5553a6b7fb335bd7c931fe5a4ff42a237d7eb68844acbf3bde50a5fa9d66504b16f3ec35249eb7167fa3caf5af0958fec277f8cf1df04c4127658de385bbb72b128e7dcfcaf23b07bc195453222062f3e81e1a2df2eeedae44697a918b1712d1e7c685937e43666df7f5aa311c2874894bdbbc25f3873f84c1c",
    "success": true
}
```

## usage
you should be able to use this url to upload the file to the bucket.
its configured to be viable for 15 minutes since the time of creation.
here is an example of how to use this url, with curl:
`curl -X PUT -H 'Content-Type: audio/mpeg' --upload-file <local_file> <signed url>`

since the bucket has public read permissions, you should be able to remove
the service account credential from the app and use this endpoint for upload,
and public api for reading.

## further reading
google docs on signed urls: https://cloud.google.com/storage/docs/access-control/signed-urls

# database migrations
TODO
# cloud endpoint details
TODO
# how crops are made
TODO
# how sequences are made
TODO
# peripheral tooling
TODO
google analytics
pm2 monitor web interface
automatic db backups NOTE cron is not working
automatic bucket backups NOTE should delete older than x days
# puppet
TODO
