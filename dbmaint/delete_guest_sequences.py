import sqlite3
import datetime as dt
import time

import heartbeat
from constants import guest, db_fp

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d


print("Deleting guest records in ", db_fp)
conn = sqlite3.connect(db_fp)
conn.row_factory = dict_factory
# conn.set_trace_callback(print)
cur = conn.cursor()

def delete_by_age_user(age, user):
    data = [user, age]
    sql = '''
            delete from sequences
            WHERE uuid in 
                (SELECT uuid FROM sequences
                    WHERE user_id = ?
                        AND JULIANDAY(CURRENT_TIMESTAMP)
                            - JULIANDAY(created) > ?)
        '''
    cur.execute(sql, data)
    conn.commit()

def get_guest_lifetime():
    lifetime = 0.00347
    try:
        with open('../dbmaint/lifetime.txt', 'r') as f:
            lifetime = f.read()
    except:
        print("lifetime file doesn't exist, using default.")
    return lifetime

def mark_highwater(record_count):
    highwater = 0
    try:
        with open('../dbmaint/highwater.txt', 'r') as f:
            highwater = int(f.read())
        if highwater < record_count:
            with open('../dbmaint/highwater.txt', 'w') as f:
                f.write(str(record_count))
    except Exception as e:
        print("Couldn't open file", e)


if __name__ == '__main__':
    lifetime = float(get_guest_lifetime())
    count0 = heartbeat.count_by_age_user(0, guest)
    delete_by_age_user(0.0034722222222222225, guest)
    count1 = heartbeat.count_by_age_user(0, guest)
    print("deleted", count0 - count1, "guest sequences older than", lifetime*60*24, "minutes")
    print(count1, "guest sequences remain at", dt.datetime.fromtimestamp(time.time()))
    mark_highwater(count1)
