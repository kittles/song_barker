import sqlite3

import uuid
import random as rand
from constants import guest, db_fp


def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

print(db_fp)
conn = sqlite3.connect(db_fp)
conn.row_factory = dict_factory
# conn.set_trace_callback(print)
cur = conn.cursor()

def insert_sequences(count, user):

    sql = '''
        INSERT INTO sequences
            (uuid, song_id, crop_id, user_id, name, 
            backing_track_url, backing_track_fp,
            bucket_url, bucket_fp, stream_url, hidden)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
    '''

    for i in range(count):
        data = [
            str(uuid.uuid4()),
            "song" + str(i),
            "crop" + str(i),
            user,
            "name" + str(i),
            "backing_track_url" + str(i),
            "backing_track_fp" + str(i),
            "bucket_url" + str(i),
            "bucket_fp" + str(i),
            None,
            0
        ]
#        print(len(data), data)
        cur.execute(sql, data)
        conn.commit()

def random_insert(upper_limit):
    count = rand.randint(0, upper_limit)
    insert_sequences(count, guest)
    return count


if __name__ == '__main__':
    count = random_insert(10)
    print("Inserted", count, "rows.")
