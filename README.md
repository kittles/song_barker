# overview
K-9 Karaoke (formerly song / sound barker) is made of up of some fairly discrete pieces:

- mobile app
- public facing web server, aka the back end
- scalable kubernetes cluster for high cpu tasks

the project has steadilly grown in scope over the year, and you will probably
notice that in some of the more ad-hoc design choices, and naming conventions.
the mobile app has been developed by Tovi, and the web server and cluster have
been developed by Patrick (the person writing these docs). i'll try to give a
succinct description here of the basic functionality provided by the different
components, before going into more detail about the pieces of each of them.

## mobile app
this is what the end users will use to generate cards. it's a flutter app that
they capture audio, video, and configure all the parameters of the card with. this app uses a
somewhat RESTful api provided by the back end for persistence, as well as handling
sessions, accounts, and some audio processing. i expect that it's fairly intuitive from
the functionality of the front end what the back end is providing to it. in any case,
i will be sure to document the apis exposed.

The puppet animations are not done natively. they are happening in a webview,
and are a three.js scene that can be communicated with through a javascript channel.

the mobile app also stores and retrives static assets like audio files and images
directly from a google cloud bucket.

for more information on the front end, [Tovi](https://github.com/handofthecode) is the person to talk to

## the back end
the back end is an express server that has
- CRUD-like apis
- custom endpoints for things like audio processing and card generation
- provider of static assets, like the javascript used to generate and animate the puppet,
as well as a page that users can view shared cards

it uses a sqlite database and the dev and prod deployments have nginx sitting in front
of the express server, and nginx handles the static assets.

just a bit more about the components here, and i will go into more detail on each
in their own sections.

### CRUD apis
i just rolled my own "orm", because the intially functionality needed was very
small. its grown a bit, and the orm and associated endpoints are a little crufty at
this point. i specify a "schema" in `server/models.js`, and the server will create
the endpoints and such from this.

### audio processing
the audio processing, which was initially developed to be run on the same machine
as the server, has become too cpu intensive to handle all but a handful of users
concurrently. you'll see a somewhat strange dir structure, with an
`/audio_processing` dir with audio processing scripts in it, and a
`/audio_processing/cloud` dir with another set of similar looking scripts (they are not the same)

### static assets / puppet
the bulk of the web front end (the web page where users go to see shared cards)
is in `server/public/puppet`, with all the logic in `puppet.js` within that dir.
this puppet code has undergone several pretty significant overhauls and has a lot
of dead code and redundant files. ill try to clean up some stuff but im sure ill miss
lots. `puppet.js` is used by both the web page for showing shared cards as well as
the client app (through a webview), which may partially explain why its kind of convoluted.

## cluster
the cluster is for doing two things- processing a raw audio file into cropped regions,
and turning a set of crops into a sequence (a set of barks into a musical song). its
a docker image deployed on kubernetes. inside the image, there is a express server that
exposes two endpoints public endpoints (for the two tasks). what happens is a client
makes a request to process a raw audio file, say, and the back end receives this request.
it then makes a request to the cluster at the appropriate endpoint. the cluster does
some audio processing, and responds to the back end when complete.
the back end then responds to the client. passing along whatever info is useful.
the audio processing logic is mostly in python,
happening in subprocesses kicked off by the express server.

# deployments
there is a dev server at `https://thedogbarksthesong.ml`
there is a prod server at `https://k-9karaoke.com`
they are both deployed on digital ocean. the servers are ubuntu 18.04
there are a handful of dependencies like ffmpeg, gs utils etc that i will try to document.

each server has a `deploy.sh` in the home dir that attempts to streamline the deployment
process. there are a number of different deployment-like things that ive needed to be able to
do (like sync / migrate stock assets and objects in the db, or update songs), so there
are some flags as well. but basically the script will just grab the latest version of the appropriate
branch from github, pull it down, make sure the python and node dependencies are good, and
restart the server.

the cluster deployment is a google cloud project. there are a number of scripts in the
`/audio_processing/cloud` dir that handle updating and configuring the deployment. they are
in various states of completeness and should probably only be used as reference. the deployment
process for the cluster is basically to build a new docker image, push that to google cloud, then
tell kubernetes to update the cluster with that new image. sometimes easier said than done, but ive
found googles docs helpful.

ill go into more detail on each of these in a distinct section.

- local_testing.md is a walk through of getting the back end server, running on your local computer, as well
as how to run and test the docker container that the cluster uses








