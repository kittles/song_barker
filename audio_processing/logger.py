import datetime as dt
import os

log_fp = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'log.txt')


def log (msg):
    with open(log_fp, 'a') as fh:
        fh.write('{} {}'.format(dt.datetime.utcnow(), msg))
    

if __name__ == '__main__':
    log('this is a test')
