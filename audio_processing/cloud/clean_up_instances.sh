read -p "cleaning up instance... are you sure? " -n 1 -r
echo    # (optional) move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

export PROJECT_ID='songbarker'
export NAME='k9-karaoke-cloud-dev:v1'
export CLUSTER_NAME='k9-karaoke-dev-cluster'
export APP_NAME='k9-karaoke-dev-app'
export SERVICE_NAME=${APP_NAME}-service

# cleanup
kubectl delete service ${SERVICE_NAME}
gcloud container clusters delete ${CLUSTER_NAME}
gcloud container images delete gcr.io/${PROJECT_ID}/${NAME}  --force-delete-tags --quiet
