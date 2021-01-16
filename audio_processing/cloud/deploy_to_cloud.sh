# dont run this, its just for reference...
read -p "creating a new google app engine cluster... are you sure? " -n 1 -r
echo    # (optional) move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

export PROJECT_ID='songbarker'
export NAME='k9-karaoke-cloud-dev:v1'

# build and push container

docker build -t gcr.io/${PROJECT_ID}/${NAME} .
docker push gcr.io/${PROJECT_ID}/${NAME}


# make cluster
export CLUSTER_NAME='k9-karaoke-dev-cluster'
gcloud config set project $PROJECT_ID
gcloud config set compute/zone us-west1-a
# NOTE preemptible flag is untested as of now
gcloud container clusters create ${CLUSTER_NAME} --preemptible
gcloud compute instances list


# deploy to GKE
export APP_NAME='k9-karaoke-dev-app'

kubectl create deployment ${APP_NAME} --image=gcr.io/${PROJECT_ID}/${NAME}
kubectl scale deployment ${APP_NAME} --replicas=1
kubectl autoscale deployment ${APP_NAME} --cpu-percent=50 --min=1 --max=5

# list "pods"
kubectl get pods


# expose to the internet
export SERVICE_NAME=${APP_NAME}-service
kubectl expose deployment ${APP_NAME} --name=${SERVICE_NAME} --type=LoadBalancer --port 80 --target-port 8080

# get info about it, like the external ip (which may be pending for a minute or so)
kubectl get service

