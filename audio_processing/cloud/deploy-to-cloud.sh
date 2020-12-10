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
kubectl expose deployment ${APP_NAME} --name=${APP_NAME}-service --type=LoadBalancer --port 80 --target-port 8080

# get info about it, like the external ip
kubectl get service


# cleanup
#kubectl delete service hello-app-service
#gcloud container clusters delete hello-cluster
#gcloud container images delete gcr.io/${PROJECT_ID}/hello-app:v1  --force-delete-tags --quiet
#gcloud container images delete gcr.io/${PROJECT_ID}/hello-app:v2  --force-delete-tags --quiet

