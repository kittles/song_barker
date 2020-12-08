gcloud functions deploy backup_dev --runtime python37 --trigger-topic dev-bucket-backup
gcloud functions deploy backup_prod --runtime python37 --trigger-topic prod-bucket-backup
