import sqlite3
import os
import datetime as dt
import time
import uuid
from constants import guest

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

db_fp = os.environ.get('k9_database', ''
                                      '../node-cron-example/k9karaoke-database-prod.db')
print(db_fp)
conn = sqlite3.connect(db_fp)
conn.row_factory = dict_factory
# conn.set_trace_callback(print)
cur = conn.cursor()

def select_by_age_user(age, user):
    data = [age, user]
    sql = '''
         SELECT uuid, user_id, created, 
             JULIANDAY(CURRENT_TIMESTAMP) - JULIANDAY(created) AS difference
         from sequences
         WHERE uuid in 
             (SELECT uuid FROM sequences
                 WHERE difference >= ?
                 AND user_id = ?)
     '''
    cur.execute(sql, data)
    try:
        rows = cur.fetchall()
        ts = dt.datetime.fromtimestamp(time.time())
        for r in rows:
            tsx = dt.datetime.fromisoformat(r['created'])
            et = ts - tsx
            print(r['uuid'], r['user_id'], r['created'], r['difference'])
        print(len(rows), "rows selected")
    except:
        print("error")


if __name__ == '__main__':
    select_by_age_user(0, guest)
