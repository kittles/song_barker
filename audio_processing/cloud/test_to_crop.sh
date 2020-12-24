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
#      "uuid": "100288f3-dbc2-45fd-b051-c90b5c53d851",
#      "bucket": "song_barker_sequences"
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
      "uuid": "100288f3-dbc2-45fd-b051-c90b5c53d851",
      "bucket": "song_barker_sequences"
    }' \
  http://34.83.134.37/to_crops
