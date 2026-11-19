#!/bin/sh
# Puts a new version of the site live, keeping the settings, the database and the uploaded files.
#   1. upload the new monolith-sports.zip to /opt (HOSTINGER.md, step 9)
#   2. sh /opt/monolith-sports/update.sh /opt/monolith-sports.zip
# The database and the uploads live in Docker volumes, not in this folder, so replacing the folder never touches
# them. The previous version is kept beside it as monolith-sports-previous until the next update.
set -eu
zip="${1:?Give the path to the new monolith-sports.zip}"
here="$(cd "$(dirname "$0")" && pwd)"
parent="$(dirname "$here")"
next="$parent/monolith-sports-next"
prev="$parent/monolith-sports-previous"

echo "1/4 backing up"
sh "$here/backup.sh"

echo "2/4 unpacking the new version"
rm -rf "$next"
mkdir -p "$next"
unzip -q "$zip" -d "$next"
# the zip holds one folder, monolith-sports/: bring its contents up
if [ -d "$next/monolith-sports" ]; then
  find "$next/monolith-sports" -mindepth 1 -maxdepth 1 -exec mv {} "$next/" \;
  rmdir "$next/monolith-sports"
fi
cp "$here/.env" "$next/.env"
chmod 600 "$next/.env"

echo "3/4 swapping the folders (the running site keeps serving meanwhile)"
rm -rf "$prev"
mv "$here" "$prev"
mv "$next" "$here"
[ -d "$prev/backups" ] && mv "$prev/backups" "$here/backups"

echo "4/4 building and starting the new version"
cd "$here"
if docker compose up -d --build; then
  docker image prune -f > /dev/null
  echo "updated. If anything looks wrong: sh $here/rollback.sh"
else
  echo "the new version did not start; the previous one is in $prev. To go back: sh $here/rollback.sh" >&2
  exit 1
fi
