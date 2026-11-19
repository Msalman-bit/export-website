#!/bin/sh
# A backup of the database and the uploaded files, kept for 14 days in ./backups.
#   sh backup.sh                     run it by hand (from this folder)
#   crontab -e, then add:            30 3 * * * cd /opt/monolith-sports && sh backup.sh >> backups/backup.log 2>&1
# Copy the backups off the server now and then (HOSTINGER.md, step 8); restoring is described there too.
set -eu
cd "$(dirname "$0")"
mkdir -p backups
stamp=$(date +%Y-%m-%d-%H%M)

# the database: a consistent snapshot while the site keeps running
docker compose exec -T db pg_dump -U monolith -d monolith --format=custom > "backups/db-$stamp.dump"

# the uploaded files (logos, artwork, product photographs added in the admin)
docker run --rm -v monolith_uploads:/data:ro -v "$PWD/backups:/out" alpine tar czf "/out/uploads-$stamp.tgz" -C /data .

# keep two weeks
find backups -type f \( -name 'db-*.dump' -o -name 'uploads-*.tgz' \) -mtime +14 -delete
echo "backup $stamp: $(du -h "backups/db-$stamp.dump" | cut -f1) database, $(du -h "backups/uploads-$stamp.tgz" | cut -f1) uploads"
