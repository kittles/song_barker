import os
import glob
import json
from google.cloud import storage

storage_client = storage.Client()

stock_root_dir = os.path.dirname(os.path.realpath(__file__))
crops_dir = os.path.join(stock_root_dir, 'barks')

# barks on bucket at stock_assets/crops
crop_bucket_base = 'stock_assets/crops'


def upload (fp, dest_fp):
    # dest_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket(os.environ.get('k9_bucket_name', 'song_barker_sequences'))
    blob = bucket.blob(dest_fp)
    # TODO the file type is text/plain in the bucket... should be audio
    blob.upload_from_filename(fp)
    print('uploaded', fp)



def main():
    print('\n crops \n')
    for crop_dir in glob.glob(os.path.join(crops_dir, '*/')):
        # TODO handle other image extensions
        crop_fp = glob.glob(os.path.join(crop_dir, '*.aac'))[0]
        info_fp = glob.glob(os.path.join(crop_dir, 'info.json'))[0]
        print('----')
        print('crop_dir:', crop_dir)
        print('crop_fp :', crop_fp)
        print('info_fp  :', info_fp)
        info = json.load(open(info_fp))
        crop_upload_fp = os.path.join(crop_bucket_base, info['uuid'] + '.aac')
        print('uploading to :', crop_upload_fp)
        upload(crop_fp, crop_upload_fp)

def dry_run():
    print("DRY RUN")
    print('\n crops \n')
    for crop_dir in glob.glob(os.path.join(crops_dir, '*/')):
        # TODO handle other image extensions
        crop_fp = glob.glob(os.path.join(crop_dir, '*.aac'))[0]
        info_fp = glob.glob(os.path.join(crop_dir, 'info.json'))[0]
        print('----')
        print('crop_dir:', crop_dir)
        print('crop_fp :', crop_fp)
        print('info_fp  :', info_fp)
        info = json.load(open(info_fp))
        crop_upload_fp = os.path.join(crop_bucket_base, info['uuid'] + '.aac')
        print('uploading to :', crop_upload_fp)


# def dry_run():
#     print("DRY RUN!!!!")
#     print('\n crops \n')
#     for crop_dir in glob.glob(os.path.join(crops_dir, '*/')):
#         # TODO handle other image extensions
#         crop_fp = glob.glob(os.path.join(crop_dir, '*.aac'))[0]
#         info_fp = glob.glob(os.path.join(crop_dir, 'info.json'))[0]
#         print('----')
#         print('crop_dir:', crop_dir)
#         print('crop_fp :', crop_fp)
#         print('info_fp  :', info_fp)
#         info = json.load(open(info_fp))
#         crop_upload_fp = os.path.join(crop_bucket_base, info['uuid'] + '.aac')

# dry_run()

main()

