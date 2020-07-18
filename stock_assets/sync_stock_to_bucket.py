import os
import glob
import json
from google.cloud import storage

storage_client = storage.Client()


def upload (fp, dest_fp):
    # dest_fp format is just the filename and subdir within the gs://bucket-name
    bucket = storage_client.bucket('song_barker_sequences')
    blob = bucket.blob(dest_fp)
    # TODO the file type is text/plain in the bucket... should be audio
    blob.upload_from_filename(fp)
    print('uploaded', fp)

stock_root_dir = os.path.dirname(os.path.realpath(__file__))
images_dir = os.path.join(stock_root_dir, 'images')
crops_dir = os.path.join(stock_root_dir, 'barks')

# images on bucket at stock_assets/images
# barks on bucket at stock_assets/crops
image_bucket_base = 'stock_assets/images'
crop_bucket_base = 'stock_assets/crops'

print('\n images \n')
for img_dir in glob.glob(os.path.join(images_dir, '*/')):
    # TODO handle other image extensions
    img_fp = glob.glob(os.path.join(img_dir, '*.jpg'))[0]
    info_fp = glob.glob(os.path.join(img_dir, 'info.json'))[0]
    print('----')
    print('image_dir:', img_dir)
    print('image_fp :', img_fp)
    print('info_fp  :', info_fp)
    info = json.load(open(info_fp))
    img_upload_fp = os.path.join(image_bucket_base, info['uuid'] + '.jpg')
    print('uploading to :', img_upload_fp)
    upload(img_fp, img_upload_fp)

print('\n crops \n')
for crop_dir in glob.glob(os.path.join(crops_dir, '*/')):
    # TODO handle other image extensions
    crop_fp = glob.glob(os.path.join(crop_dir, '*.aac'))[0]
    info_fp = glob.glob(os.path.join(crop_dir, 'info.json'))[0]
    print('----')
    print('crop_dir:', img_dir)
    print('crop_fp :', img_fp)
    print('info_fp  :', info_fp)
    info = json.load(open(info_fp))
    crop_upload_fp = os.path.join(crop_bucket_base, info['uuid'] + '.jpg')
    print('uploading to :', crop_upload_fp)
    upload(crop_fp, crop_upload_fp)
