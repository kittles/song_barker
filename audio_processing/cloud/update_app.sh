# dont run this, its just for reference...
read -p "updating app... are you sure? " -n 1 -r
echo    # (optional) move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi
docker build -t gcr.io/${PROJECT_ID}/hello-app:v2 .
docker push gcr.io/${PROJECT_ID}/hello-app:v2
kubectl set image deployment/hello-app hello-app=gcr.io/${PROJECT_ID}/hello-app:v2
watch kubectl get pods
