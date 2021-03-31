# overview
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

## general server stuff
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

## cluster
the cluster is a kubernetes cluster on google cloud services.
its accessible via http at `http://34.83.134.37`
the whole thing is dockerized, so you can consult the Dockefile
to get a sense of what the actual server architecture is.
the `local_testing.md` discusses deploying as well (see "the cluster" section), but succinctly,
you update the version number `/audio_processing/cloud/update_app.sh`
and then run that script. it will push the new docker image, and
then tell the cluster to use that.

