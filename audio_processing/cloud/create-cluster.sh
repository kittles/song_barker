# dont run this, its just for reference...
read -p "creating a new google app engine cluster... are you sure? " -n 1 -r
echo    # (optional) move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi


export PROJECT_ID='songbarker'
export CLUSTER_NAME='k9-karaoke-preemtible-cluster'

gcloud config set project $PROJECT_ID
gcloud config set compute/zone us-east1
gcloud container clusters create ${CLUSTER_NAME} --preemptible
gcloud compute instances list
