#! /bin/bash

curl --header "Content-Type: application/json" \
  --request POST \
  --data \
    '{
      "access_token": "very-secret-access-token-from-hell",
      "song": {
        "id": 1,
        "name": "Happy Birthday",
        "bucket_url": "gs://song_barker_sequences/midi_files/1.mid",
        "bucket_fp": "midi_files/1.mid",
        "track_count": 3,
        "bpm": 120,
        "key": 0,
        "price": 0.99,
        "category": "Festive",
        "song_family": null,
        "arrangement": "pitched",
        "style": "guitar",
        "backing_track": "1",
        "backingtrack_offset": null,
        "display_order": 3,
        "obj_type": "song"
      },
      "crops": [
        {
          "uuid": "ab9bcc7f-31cd-49e3-8d36-42857fa348c9",
          "raw_id": "f763e606-25d2-461e-ad73-a864face28d6",
          "user_id": "pat.w.brooks@gmail.com",
          "name": "me 1",
          "bucket_url": "gs://song_barker_sequences/f763e606-25d2-461e-ad73-a864face28d6/cropped/ab9bcc7f-31cd-49e3-8d36-42857fa348c9.aac",
          "bucket_fp": "f763e606-25d2-461e-ad73-a864face28d6/cropped/ab9bcc7f-31cd-49e3-8d36-42857fa348c9.aac",
          "stream_url": null,
          "hidden": 0,
          "created": "2020-12-03 05:23:55",
          "is_stock": 0,
          "duration_seconds": 0.769546485260771,
          "crop_type": null,
          "obj_type": "crop"
        },
        {
          "uuid": "4fddd98c-d2af-42c2-81fc-ae97947d1f25",
          "raw_id": "f763e606-25d2-461e-ad73-a864face28d6",
          "user_id": "pat.w.brooks@gmail.com",
          "name": "me 2",
          "bucket_url": "gs://song_barker_sequences/f763e606-25d2-461e-ad73-a864face28d6/cropped/4fddd98c-d2af-42c2-81fc-ae97947d1f25.aac",
          "bucket_fp": "f763e606-25d2-461e-ad73-a864face28d6/cropped/4fddd98c-d2af-42c2-81fc-ae97947d1f25.aac",
          "stream_url": null,
          "hidden": 0,
          "created": "2020-12-03 05:23:55",
          "is_stock": 0,
          "duration_seconds": 0.9905895691609977,
          "crop_type": null,
          "obj_type": "crop"
        },
        {
          "uuid": "f1253b68-0da9-4bdf-9536-164d0b981f19",
          "raw_id": "f763e606-25d2-461e-ad73-a864face28d6",
          "user_id": "pat.w.brooks@gmail.com",
          "name": "me 3",
          "bucket_url": "gs://song_barker_sequences/f763e606-25d2-461e-ad73-a864face28d6/cropped/f1253b68-0da9-4bdf-9536-164d0b981f19.aac",
          "bucket_fp": "f763e606-25d2-461e-ad73-a864face28d6/cropped/f1253b68-0da9-4bdf-9536-164d0b981f19.aac",
          "stream_url": null,
          "hidden": 0,
          "created": "2020-12-03 05:23:56",
          "is_stock": 0,
          "duration_seconds": 1.284172335600907,
          "crop_type": null,
          "obj_type": "crop"
        }
      ]
    }' \
  http://localhost:8080/to_sequence
