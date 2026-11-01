ARG REGISTRY="docker.io/library"
ARG BUILD_IMAGE='node'
ARG BUILD_TAG='lts-trixie@sha256:6d2c7d5d074bf72f81ddc252b4fbb5d625bc028eeda49cb4b8c2ff8eda1ee617'
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
