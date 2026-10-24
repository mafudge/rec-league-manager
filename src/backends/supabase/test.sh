#!/bin/sh
# Unit tests for the Edge Function's modules, run with Deno in Docker (no host install).
set -e
cd "$(dirname "$0")"
exec docker run --rm -v "$PWD/docker/volumes/functions/api:/app" -w /app denoland/deno:2.1.4 test --allow-env "$@"
