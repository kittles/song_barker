#! /bin/bash

#curl \
#  --request GET \
#  http://localhost:49160/am-i-alive-i-hope-so
#
#curl --header "Content-Type: application/json" \
#  --request POST \
#  --data \
#    '{
#      "access_token": "very-secret-access-token-from-hell",
#      "uuid": "aca26c15-abd1-4d0a-ab4e-88d5ad803501",
#      "bucket": "k9karaoke-prod"
#    }' \
#  http://localhost:49160/to_crops

curl \
  --request GET \
  http://34.83.134.37/am-i-alive-i-hope-so

curl --header "Content-Type: application/json" \
  --request POST \
  --data \
    '{
      "access_token": "very-secret-access-token-from-hell",
      "uuid": "aca26c15-abd1-4d0a-ab4e-88d5ad803501",
      "bucket": "k9karaoke-prod"
    }' \
  http://34.83.134.37/to_crops
