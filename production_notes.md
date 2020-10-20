# production server notes
branch is `prod`
server is at `68.183.113.8`
domain is `k-9karaoke.com`
see `config.sh` for all the env vars

## initial setup
follow: https://www.digitalocean.com/community/tutorials/initial-server-setup-with-ubuntu-20-04

created user "patrick"
UFW firewall

## nginx setup
follow: https://www.digitalocean.com/community/tutorials/how-to-install-nginx-on-ubuntu-20-04

using /etc/nginx/sites-enabled/default
server logs are at:
    - /var/log/nginx/access.log: Every request to your web server is recorded in this log file unless Nginx is configured to do otherwise.
    - /var/log/nginx/error.log: Any Nginx errors will be recorded in this log.


## ssl encryption for nginx
follow: https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04

- email used was: turboblasterllc@gmail.com

## DNS from namecheap to digital ocean
https://www.digitalocean.com/community/tutorials/how-to-point-to-digitalocean-nameservers-from-common-domain-registrars

## DNS records setup on digital ocean
https://www.digitalocean.com/docs/networking/dns/how-to/manage-records/

- A records for k-9karaoke.com and www.k-9karaoke.com

## set up node
follow https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04


## server config and prep for app

```bash
patrick@k9-karaoke-droplet ~ $ cat README.md 
This is a log of the steps taken to set up this server


# this is just stuff from digital ocean guides
#sudo apt update
#sudo apt install nginx
#sudo ufw app list
#sudo ufw allow 'Nginx HTTP'
#sudo ufw allow 'Nginx HTTPS'
#sudo ufw status
#systemctl status nginx
#vim /etc/nginx/sites-enabled/default 
#sudo vim /etc/nginx/sites-enabled/default 
#sudo vim /etc/nginx/nginx.conf 
#sudo nginx -t
#sudo systemctl restart nginx
#sudo apt install certbot python3-certbot-nginx
#cat /etc/nginx/sites-enabled/default 
#sudo ufw allow 'Nginx Full'
#sudo ufw delete allow 'Nginx HTTP'
#sudo ufw status
#sudo ufw reset
#sudo certbot --nginx -d k-9karaoke.com -d www.k-9karaoke.com
#sudo systemctl status certbot.timer
#sudo certbot renew --dry-run
#cd ~

# set up node and npm
curl -sL https://deb.nodesource.com/setup_14.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
sudo apt install nodejs
sudo apt install build-essential

# install pm2
sudo npm install pm2@latest -g

# configure git
git config --global user.name "kittles"
git config --global user.email "pat.w.brooks@gmail.com"

# generate ssh keypair (dont forget to add this to your github account at https://github.com/settings/keys)
ssh-keygen -t rsa -b 2048 -C "pat.w.brooks@gmail.com"

# get the k-9 code
git clone git@github.com:kittles/song_barker.git

sudo apt-get install python-dev   # for python2.x installs
sudo apt-get install python3-dev  # for python3.x installs
sudo apt install rubberband-cli
sudo apt install sox
sudo apt install ffmpeg
sudo apt install sqlite3

# python env
sudo apt install virtualenv
cd audio_processing
virtualenv -p python3 .env
source .env/bin/activate
pip install -r requirements.txt

# server's npm requirements
cd ../server
npm install

# get credentials to server somehow

# from project root, run this to set env vars
# `. ./config.sh`

# set ssh to stay alive so you arent constantly booted from the server
# edit /etc/ssh_config as follows:
#ClientAliveInterval 120
#ClientAliveCountMax 720
# then `sudo systemctl reload sshd`

# init database, from /song_barker/server
# `./initialize_database

# init bucket
# TODO make a gsutil script instead of manually making on in the web console
# ...

# NEXT set up pm2 config for running app


# some niceities
added vim dotfiles
alias lss=ls -lhX --show-directories-first
```
