ARG REGISTRY="docker.io/library"
ARG BUILD_IMAGE='node'
ARG BUILD_TAG='lts-trixie@sha256:be40f6a87b9b22215ddb20da0a2320a5c6d583fe3ee3b0024d9fa4f05b40c8fd'
ARG BASE_IMAGE='nginxinc/nginx-unprivileged'
ARG BASE_TAG='stable-alpine'

FROM $REGISTRY/$BUILD_IMAGE:$BUILD_TAG AS builder

WORKDIR /src
COPY . /src

# do it twice (initial install fails if fresh for some reason)
RUN npm install
RUN npm install
RUN npm run build -- --output-path="/artifacts/dist"


FROM $REGISTRY/$BASE_IMAGE:$BASE_TAG
COPY --chown=nginx:nginx --from=builder /artifacts/dist /usr/share/nginx/html/dist
COPY ./support/nginx.conf /etc/nginx/nginx.conf
COPY ./support/config.json /usr/share/nginx/html/dist/assets/config.json
