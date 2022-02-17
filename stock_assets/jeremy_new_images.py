'''
     use jeremy's existing images as stock images

for each row in the db
    make a dir in stock/images for the info.json and *.jpg
    download the image from the bucket to the local dir
    generate the info.json based on the row and write to file
'''

import csv
import json
import os
from google.cloud import storage

storage_client = storage.Client()
reader = csv.DictReader(open('./jeremy_dogs.csv'))


def download_filename_from_bucket (remote_fp, fp):
    '''
    for getting dog images from the bucket
    '''
    # remote_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(os.environ.get('k9_bucket_name', 'song_barker_sequences'))
    blob = bucket.blob(remote_fp)
    blob.download_to_filename(fp)
    #print('downloaded', remote_fp)


if __name__ == '__main__':
    c = 0
    for row in reader:

        # skip unwanted rows
        if int(row['is_stock']) or int(row['hidden']):
            print('STOCK OR HIDDEN - skipping row', row['name'])
            continue

        name = row['name']
        print(name);
        uuid = row[0];
        print(uuid);
        uuid = row['uuid']

        # mouth color can be round or square braces or null
        # so homogenize here
        try:
            mouth_color = list(eval(row['mouth_color']))
        except:
            print('WARNING: no mouth color for ', name)
            mouth_color = None

        try:
            coordinates_json = json.loads(row['coordinates_json'])
        except:
            coordinates_json = None
            print('WARNING (SKIPPING): no coordinates_json for ', name)
            continue

        out_dict = {
            'name': name,
            'uuid': uuid,
            'coordinates_json': coordinates_json,
            'mouth_color': mouth_color,
        }

        out_fp = './images/{}'.format(name)
        info_fp = os.path.join(out_fp, 'info.json')
        jpg_fp = os.path.join(out_fp, '{}.jpg'.format(name))
        remote_jpg_fp = row['bucket_fp']

        ##print('--- \n')

        ## make the dir for the info and image
        try:
            os.mkdir(out_fp)
        except:
            print('DIR ALREADY EXISTS, OVERWRITING: {}'.format(out_fp))
        #print('output fp: {}'.format(out_fp))

        ## make the info.json file
        ##print('generating stock dog image with following data (info.json)')
        ##print(json.dumps(out_dict, indent=4))
        with open(info_fp, 'w') as fh:
            fh.write(json.dumps(out_dict, indent=4))

        ## download the dog image
        ##print('downloading jpg from {} to {}'.format(remote_jpg_fp, jpg_fp))
        download_filename_from_bucket(remote_jpg_fp, jpg_fp)
