#!/bin/sh
set -eu

# Persistent volumes are often mounted as root after the image is built.
if [ "$(id -u)" = 0 ]; then
  chown -R node:node /app/data
  exec su-exec node npm start
fi
exec npm start
