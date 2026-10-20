#!/usr/bin/env bash
set -eu
cd /workspace/X-Tennis-
npm ci --ignore-scripts --cache /tmp/zimo-npm
npm --prefix cloudfunctions/api ci --ignore-scripts --cache /tmp/zimo-npm
npm run build
