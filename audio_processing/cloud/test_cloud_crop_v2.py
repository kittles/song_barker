import subprocess as sp
with open('./test_raw_uuids.txt', 'r') as raw_uuids:
    for line in raw_uuids:
        uuid = line.strip()
        sp.call('python cloud_crop_v2.py -i {} -d -b song_barker_sequences'.format(
            uuid
        ), shell=True)
        input()
