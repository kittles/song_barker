'''
this should run with every deploy

its atomic on a user level so it shouldnt mess with people currently using the app?
'''
import sqlite3
import glob
import json
import os
from google.cloud import storage
import uuid
import argparse
import subprocess as sp


def dict_factory (cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d


if __name__ == '__main__':
    db_fp = os.environ.get('k9_database', '../server/k9karaoke-database-prod.db')
    conn = sqlite3.connect(db_fp)
    conn.row_factory = dict_factory
    #conn.set_trace_callback(print)
    cur = conn.cursor()
    cur.execute('SELECT user_id FROM users')
    for row in cur.fetchall():
        cmd = 'python add_barks_to_user.py -u "{}"'.format(row['user_id'])
        sp.call(cmd, shell=True)


