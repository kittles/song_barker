import sqlite3

import datetime as dt
import time
import uuid
from constants import guest, db_fp

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

print("querying", db_fp)
conn = sqlite3.connect(db_fp)
conn.row_factory = dict_factory
# conn.set_trace_callback(print)
cur = conn.cursor()

def count_by_age_user(age, user):
    data = [age, user]
    sql = '''
         SELECT COUNT(*) as len
         from sequences
         WHERE uuid in 
             (SELECT uuid FROM sequences
                 WHERE JULIANDAY(CURRENT_TIMESTAMP)
                            - JULIANDAY(created) > ?
                 AND user_id = ?)
     '''
    cur.execute(sql, data)
    row = cur.fetchone()
    return row['len']

def heartbeat():
    count = count_by_age_user(0, guest)
    print(count, "guest sequences at", dt.datetime.fromtimestamp(time.time()))


if __name__ == '__main__':
    heartbeat()
