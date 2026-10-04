#!/bin/sh
set -eu
if [ "$(id -u)" = 0 ]; then
  chown -R node:node /app/data
  exec su-exec node npm start
fi
exec npm start
