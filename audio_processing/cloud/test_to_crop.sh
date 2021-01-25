#! /bin/bash

# local running container

#curl \
#  --request GET \
#  http://localhost:49160/am-i-alive-i-hope-so
#
#curl --header "Content-Type: application/json" \
#  --request POST \
#  --data \
#    '{
#      "access_token": "very-secret-access-token-from-hell",
#      "uuid": "fda83a10-99d8-44e3-bf95-8c7658741de7",
#      "bucket": "song_barker_sequences"
#    }' \
#  http://localhost:49160/to_crops

# the container in the cloud

curl \
  --request GET \
  http://34.83.134.37/am-i-alive-i-hope-so

curl --header "Content-Type: application/json" \
  --request POST \
  --data \
    '{
      "access_token": "very-secret-access-token-from-hell",
      "uuid": "fda83a10-99d8-44e3-bf95-8c7658741de7",
      "bucket": "song_barker_sequences"
    }' \
  http://34.83.134.37/to_crops
