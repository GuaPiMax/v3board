#!/bin/bash
# Build maintained frontend source; server updates use prebuilt assets.
set -euo pipefail
cd "$(dirname "$0")"
node scripts/build-admin.mjs
