FROM ubuntu:bionic

# python
RUN : \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        software-properties-common \
    && add-apt-repository -y ppa:deadsnakes \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        python3.8-venv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && :

RUN python3.8 -m venv /venv
ENV PATH=/venv/bin:$PATH

# curl (needed for node)
RUN apt-get update && apt-get install -y curl

# node
ENV NODE_VERSION=12.6.0
RUN apt install -y curl
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"
RUN node --version
RUN npm --version

# audio processing
RUN apt-get update && apt-get install -y sox
RUN apt-get update && apt-get install -y ffmpeg
RUN apt-get update && apt-get install -y rubberband-cli

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN pip3 install -r requirements.txt

ENV GOOGLE_APPLICATION_CREDENTIALS="/usr/src/app/credentials/bucket-credentials.json"
CMD ["node", "server.js"]

#RUN python install -r requirements.txt
#RUN npm install
# set env vars?
