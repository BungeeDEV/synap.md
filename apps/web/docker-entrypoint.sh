#!/bin/sh
set -e

mkdir -p /data
chown -R nuxt:nuxt /data

exec gosu nuxt "$@"
