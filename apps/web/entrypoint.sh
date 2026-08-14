#!/bin/sh
set -e

# Fresh Docker volumes are created owned by root:root, but the app runs as
# the non-root `synap` user (see Dockerfile) for security. Without this
# fix, a brand-new /data volume leaves `synap` unable to write, and every
# DB access fails with "Database not initialized - initDb() must run
# before getDb() is called". This script runs briefly as root (container
# starts as root - see Dockerfile) to create the required paths and chown
# /data to synap, then drops privileges via su-exec before starting the
# app. Do NOT reintroduce a static `USER synap` in the Dockerfile - if
# "USER synap fehlt" and you add it back, this chown step can no longer
# run and the bug returns.

VAULT_PATH="${NUXT_VAULT_PATH:-/data/vault}"
DATA_PATH="${NUXT_DATA_PATH:-/data/app.db}"

mkdir -p "$VAULT_PATH"
mkdir -p "$(dirname "$DATA_PATH")"

chown -R synap:synap /data

exec su-exec synap:synap "$@"
