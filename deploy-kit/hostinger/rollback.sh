#!/bin/sh
# Goes back to the version that was live before the last update.sh (the database and uploads are left as they are).
#   sh /opt/monolith-sports/rollback.sh
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
parent="$(dirname "$here")"
prev="$parent/monolith-sports-previous"
[ -d "$prev" ] || { echo "no previous version in $prev" >&2; exit 1; }
failed="$parent/monolith-sports-failed"
rm -rf "$failed"
mv "$here" "$failed"
mv "$prev" "$here"
[ -d "$failed/backups" ] && mv "$failed/backups" "$here/backups"
cd "$here"
docker compose up -d --build
echo "back on the previous version; the one that was rolled back is in $failed"
