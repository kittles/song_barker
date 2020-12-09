import time
from locust import HttpUser, task, between

class QuickstartUser (HttpUser):

    wait_time = between(1, 2)

    @task
    def card (self):
        self.client.get("/card/bd7a7ca3-136c-4149-8e03-ef7ca48d5851")

    #@task
    #def login (self):
    #    self.client.post("/manual-login", json={"username":"pat.w.brooks@gmail.com", "password":"asdfasdf"})

    @task
    def to_crops (self):
        self.client.headers
        response = self.client.post("/to_crops", json={
            "uuid": "100288f3-dbc2-45fd-b051-c90b5c53d851",
            "image_id": 1,
        })

    def on_start(self):
        response = self.client.post("/manual-login", json={
            "email":"pat.w.brooks@gmail.com",
            "password":"asdfasdf",
        })
        print(vars(response))
