# dont run this, its just for reference...

export PROJECT_ID='songbarker'
export NAME='k9-karaoke-cloud-dev:v1'

# build and push container

docker build -t gcr.io/${PROJECT_ID}/${NAME} .
docker push gcr.io/${PROJECT_ID}/${NAME}


# make cluster
export CLUSTER_NAME='k9-karaoke-dev-cluster'
gcloud config set project $PROJECT_ID
gcloud config set compute/zone us-west1-a
gcloud container clusters create ${CLUSTER_NAME}
gcloud compute instances list


# deploy to GKE
export APP_NAME='k9-karaoke-dev-app'

kubectl create deployment ${APP_NAME} --image=gcr.io/${PROJECT_ID}/${NAME}
kubectl scale deployment ${APP_NAME} --replicas=3
kubectl autoscale deployment ${APP_NAME} --cpu-percent=80 --min=1 --max=5

# list "pods"
kubectl get pods


# expose to the internet
export SERVICE_NAME=${APP_NAME}-service
kubectl expose deployment ${APP_NAME} --name=${SERVICE_NAME} --type=LoadBalancer --port 80 --target-port 8080

# get info about it, like the external ip (which may be pending for a minute or so)
kubectl get service


# cleanup
#kubectl delete service ${SERVICE_NAME}
#gcloud container clusters delete ${CLUSTER_NAME}
#gcloud container images delete gcr.io/${PROJECT_ID}/${NAME}  --force-delete-tags --quiet

