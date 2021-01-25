# dont run this, its just for reference...
read -p "updating app... are you sure? " -n 1 -r
echo    # (optional) move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

export PROJECT_ID='songbarker'
export NAME='k9-karaoke-cloud'
export VERSION='v8'
export APP_NAME='k9-karaoke-dev-app'
export CONTAINER_NAME=gcr.io/${PROJECT_ID}/${NAME}:${VERSION}


docker build -t ${CONTAINER_NAME} .
docker push ${CONTAINER_NAME}

#kubectl set image deployment ${APP_NAME} ${APP_NAME}=${CONTAINER_NAME}
kubectl set image deployment/${APP_NAME} k9-karaoke-cloud-dev=${CONTAINER_NAME}
watch kubectl get pods
