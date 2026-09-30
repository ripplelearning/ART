#!/usr/bin/env bash
# Activates an uploaded ART release on the web server.
# Executed over SSH by the deploy workflow with DEPLOY_ROOT, RELEASE and
# KEEP_RELEASES supplied as environment variables.
set -euo pipefail

: "${DEPLOY_ROOT:?DEPLOY_ROOT is required}"
: "${RELEASE:?RELEASE is required}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

RELEASE_DIR="$DEPLOY_ROOT/releases/$RELEASE"

if [ ! -f "$RELEASE_DIR/index.html" ]; then
  echo "Release $RELEASE is incomplete: index.html is missing." >&2
  exit 1
fi

# Atomic swap so visitors never see a half-updated document root.
ln -sfn "$RELEASE_DIR" "$DEPLOY_ROOT/current.tmp"
mv -Tf "$DEPLOY_ROOT/current.tmp" "$DEPLOY_ROOT/current"

cd "$DEPLOY_ROOT/releases"
ls -1dt -- */ | tail -n "+$((KEEP_RELEASES + 1))" | xargs -r rm -rf --

echo "Activated release $RELEASE"
