# local testing
ill try to outline the process of running the back end, as well as a
docker image that would be in the cluster here. i develop on ubuntu,
and found it was mostly frictionless to use os x, but i figure its good
to be aware in case there are some subtle os specific issues that crop up.


# the back end
this is the thing with the rest apis, the puppet animation stuff, the database etc.

## getting started
run `git clone https://github.com/kittles/song_barker.git`

install the system-wide dependencies:
```
sudo apt-get install python-dev
sudo apt-get install python3-dev
sudo apt install rubberband
sudo apt install sox
sudo apt install ffmpeg
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

- `bucket-credentials.json` (this lets a server talk to the bucket)
- `cloud-access-token.json` (this is a *HIGHLY SECURE* token that the back end uses when
talking to the cluster)
- `email.json` (this holds the credentials for the account used to send signup emails and the like)
- `facebook_app_access_token.json` (for facebook openid)

## environment variables
there are a number of environment varibles that need to be set in the current shell context
in order to run the server. my solution is to have a set of scripts that live in a different
repo [song_barker_config](https://github.com/kittles/song_barker_config) and to symbolically
link the desired config file to `/config.sh` in the song_barker repo. then, to put the env
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
empty database, and youll have to run some scripts to populate it with stock objects and songs.


## running the server
navigate to `/server` and run `npm run dev`. you should see a bit of info about the current
env vars, and then a log of requests. id suggest you try going to a page in the browser,
something like `http://localhost:3000/all/song` and see if you get anything.

hopefully that all worked, but its very likely that ive missed some initialization step, so please
ask me if you are running into anything that is confusing (and it would be good to add to this
page anything you run into)

here are my guesses if something isnt working:
- you are missing something in `/credentials`
- you havent installed the python or more likely the node requirements
- there is no database file

# the cluster
this is the thing in `/audio_processing/cloud`.
this is a little more cumbersome to test with, but a little easier to get going initially. you can
of course run the python scripts on their own, and they should be designed to be fairly modular in that
way. just make sure you create a `./cloud-env` virtual environment and install the requirements, and 
activate that environment when testing, with `source .cloud-env/bin/activate` (on linux).

but often youll need to test the actual docker container before deploying it to the cluster.
i honestly never remember docker command flags and format so i just wrote a bunch of short
shell scripts. you should really only consider them a reference, they are in various states of
working / usefulness. in any case, i would `./build_container.sh`
and then `./run_container.sh`. there are a few `test_to_*` scripts there that are just cURLs to the local or remote container.
make sure you comment or uncomment the appropriate cURL before running them. also, they depend on stuff being in the bucket, so
make sure a file with the corresponding uuid is in fact actually in the bucket.

so you can run a test script or two and confirm that the new container is working. from there, youll
need to deploy the thing to the cluster. i have an outline of this in `update_app.sh` but you will need
to manually update the version number. im not very familiar with cluster orchestration or the google
infrastructure, and id guess that there are simpler ways of doing this. in any case, you can
watch the output until you see the cluster has new containers, and then hit them up with the same
`test_to_*` scripts, making sure they are actually hitting the cluster endpoint.

i often find it handy to open up a shell in the container, which can be done with `./container_shell.sh`
