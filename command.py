import subprocess as sp
import yaml

config = yaml.load(open('config.yml', 'r'), Loader=yaml.FullLoader)


def make_bucket ():
    pass


def destroy_bucket ():
    pass


def make_db ():
    pass


def destroy_db ():
    pass


def run (cmd):
    sp.call(cmd, shell=True)
    # TODO put stdout somewhere referenceable


def install_python_requirements ():
    pass


def install_node_requirements ():
    pass


def use_python_env ():
    pass


def restart_server ():
    pass


def notify_discord ():
    pass


def deploy ():
    commands = [
        'git stash',
        'git pull origin master',
        'cd audio_processing',
        'source .env/bin/activate',
        'pip install -r requirements.txt',
        'deactivate',
        'cd ../server',
        'npm install',
        'pm2 restart app.js',
        '',
        '',
    ]
