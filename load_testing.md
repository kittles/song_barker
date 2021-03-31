# load testing
i have a very rudimentary set up to load test endpoints.
to do so, from the `/load_testing` dir,
run `locust` (with the audio processing python env activated) and go to `http://0.0.0.0:8089/`
to use the web interface

`/load_testing/locustfile.py` is where you can specify tasks for it to run

this is useful to get a rough sense of how many concurrent users an endpoint or
deployment can handle.
