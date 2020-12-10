import time
import json
from locust import HttpUser, task, between

class QuickstartUser (HttpUser):

    wait_time = between(0.5, 1)

    @task
    def all_crop (self):
        self.client.get("/all/crop")

    @task
    def all_raw (self):
        self.client.get("/all/raw")

    @task
    def all_song (self):
        self.client.get("/all/song")

    @task
    def card (self):
        self.client.get("/card/bd7a7ca3-136c-4149-8e03-ef7ca48d5851")

    #@task
    #def login (self):
    #    self.client.post("/manual-login", json={"username":"pat.w.brooks@gmail.com", "password":"asdfasdf"})

    @task
    def to_crops (self):
        response = self.client.post("/to_crops", json={
            "uuid": "100288f3-dbc2-45fd-b051-c90b5c53d851",
            "image_id": "c0c1d023-fd69-448a-9f2d-8752d8c4345d",
        })

    @task
    def to_sequence (self):
        response = self.client.post("/to_sequence", json={
            "uuids": [
                "031a9d98-6b79-49eb-b73f-d1812f73d3e1",
                "0f16a36c-0903-4e58-87d3-e262afdeb221",
                "0f3cf819-36b1-4216-976a-ec0fc136c2c9",
            ],
            "song_id": "1", #short happy birthday
        })

    def on_start(self):
        response = self.client.post("/manual-login", json={
            "email":"pat.w.brooks@gmail.com",
            "password":"asdfasdf",
        })
        print(vars(response))
