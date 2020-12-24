# Cloud Stuff
these are things that bog down the cpu if they run on the server machine, so
ive decided to move them to a cluster that can scale as needed (supposedly)

the two functions are `to_crops` and `to_sequence`, since they peg the cpu as soon
as there are more than a couple of them going. ive reworked the versions in /audio_processing
to function without having a database present, and then ill write some more endpoints to use
the cloud functions instead of the ones on the server, maybe
`/cloud/to_crops` and `/cloud/to_server`

i should probably remove the old local versions as soon as possible.

follow the outline at `https://cloud.google.com/kubernetes-engine/docs/tutorials/hello-app#cloud-shell`
to see the basic flow


## questions
- run express server with pm2 needed?
- need some kind of auth so only servers can hit the endpoints


## project setup

# Endpoints

# POST /to_crops
just need a uuid, since all the other stuff is needed
for db entries, and happens main server side

essentially just proxies a request to `cloud_crop.py`,
and then returns that scripts output to the original server.

returns a json object that looks like
```json
{
    data: {
        crops: [
            {
                uuid: '',
                bucket_filepath: '',
                duration: '',
            }
            ...
        ]
    },
    stderr: '',
    ?
}
```
