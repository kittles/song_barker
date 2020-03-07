import datetime as dt
import os
import logging
import time
from logging.handlers import RotatingFileHandler

log_fp = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'log.txt')
_logger = logging.getLogger('Rotating Log')
_logger.setLevel(logging.INFO)
handler = RotatingFileHandler(log_fp, maxBytes=1e+8,
                              backupCount=5)
_logger.addHandler(handler)


def log (msg):
    log_prefix = '[date: {}] [file: {}] [id: {}]'.format(dt.datetime.utcnow(), 'no-file', 'no-id')
    _logger.info('{} {}'.format(log_prefix, msg))


def log_fn (filename):
    def log (_id, msg):
        log_prefix = '[date: {}] [file: {}] [id: {}]'.format(dt.datetime.utcnow(), filename, _id)
        _logger.info('{} {}'.format(log_prefix, msg))
    return log
