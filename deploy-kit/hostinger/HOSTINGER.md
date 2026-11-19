# Putting the site live on a Hostinger VPS

One small server runs everything: the website, its PostgreSQL database and Caddy, which serves it over HTTPS and
renews the certificate by itself. You need about an hour the first time. Every command below is typed on the server
unless it says "on your PC".

**What you need first**
- A Hostinger **KVM VPS** (not "Web hosting" or "Cloud hosting": those have no PostgreSQL). KVM 1 is enough to
  start; KVM 2 leaves room to grow. When asked for an operating system, choose **Ubuntu 24.04 with Docker** (or plain
  Ubuntu 24.04 and turn on Docker in hPanel > VPS > Docker Manager).
- Your domain (at Hostinger or elsewhere) and access to its DNS settings.
- `monolith-sports.zip` from the project's `deploy/` folder on your PC.
- Optional but strongly recommended: a free [Resend](https://resend.com) account, so inquiry emails are sent.

Write down the VPS's **IP address** and **root password** (hPanel > VPS > Overview).

---

## 1. Point the domain at the server

In hPanel > Domains > your domain > **DNS / Nameservers** (or at your domain's own registrar), set:

| Type | Name | Points to |
|---|---|---|
| A | `@` | the VPS IP address |
| A | `www` | the VPS IP address |

Delete any other `A` or `AAAA` records for `@` and `www`. Changes usually take minutes, sometimes a few hours.

**Before you continue:** the site tells browsers to use only HTTPS on this domain **and all its subdomains** for two
years. If any subdomain (an old shop, `mail.`, `shop.`) has no HTTPS, give it HTTPS first or it will stop opening.

## 2. Open only the ports the site needs

hPanel > VPS > **Security > Firewall**: create a rule set that **accepts** TCP 22 (SSH), TCP 80, TCP 443 and
UDP 443, and **drops** everything else. Attach it to the VPS.

## 3. Copy the site to the server

**On your PC**, in PowerShell (replace `SERVER-IP`):

```powershell
scp "S:\Final Boss\deploy\monolith-sports.zip" root@SERVER-IP:/opt/
```

Then sign in to the server (in PowerShell: `ssh root@SERVER-IP`, or hPanel > VPS > **Browser terminal**) and unpack it:

```sh
apt-get update && apt-get install -y unzip
cd /opt && unzip -q monolith-sports.zip -d monolith-sports && cd monolith-sports
docker --version          # must print a version; if not, turn on Docker in hPanel > VPS > Docker Manager
```

## 4. Fill in the settings

```sh
cp .env.hostinger.example .env
openssl rand -base64 48     # copy the result into APP_SECRET
openssl rand -hex 24        # copy the result into POSTGRES_PASSWORD
nano .env                   # fill in the rest; save with Ctrl+O, Enter, exit with Ctrl+X
chmod 600 .env
```

In `.env`: `SITE_HOST` is the main address (for example `www.monolithsports.com`), `ALT_HOST` the other one
(`monolithsports.com`), `SITE_URL` the main one with `https://`. Choose a long, new password for `SEED_ADMIN_PASSWORD`.

## 5. Start it

```sh
docker compose up -d --build
docker compose ps           # after a minute: db, app and caddy "running", app and db "healthy"
docker compose logs -f caddy   # watch for "certificate obtained successfully", then Ctrl+C
```

Open `https://` your address in a browser. If the certificate is not issued, the DNS from step 1 has not reached the
server yet, or the firewall from step 2 is closing port 80 or 443: wait, check, then `docker compose restart caddy`.

## 6. Sign in, then remove the first-admin lines

1. Go to `/admin/login`, sign in with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, and set up two-factor
   sign-in with your authenticator app.
2. On the server, delete the two `SEED_ADMIN_` lines from `.env` (`nano .env`), then `docker compose up -d`.
3. Add your staff in Admin > Staff and roles.

The live site starts with an empty database: the inquiries, staff and analytics on your PC stay there.

## 7. Email (Resend)

1. In Resend, **Domains > Add domain**: enter your domain. Resend shows a few DNS records (TXT, MX, CNAME).
2. Add each of them in hPanel > Domains > DNS exactly as shown, then click **Verify** in Resend.
3. Create an API key in Resend and put it in `.env` as `RESEND_API_KEY`; set `EMAIL_FROM` to an address on your
   domain and `ADMIN_NOTIFY_EMAIL` to where you want new inquiries announced. Then `docker compose up -d`.
4. Send yourself a test quote request from the site: you should get the confirmation, and the notice at
   `ADMIN_NOTIFY_EMAIL`. Every email is also listed in Admin > Email outbox.

## 8. Backups

Hostinger keeps a weekly snapshot of the whole VPS (hPanel > VPS > Backups). Add a daily backup of the database
and the uploaded files:

```sh
sh /opt/monolith-sports/backup.sh    # once by hand: it prints the sizes
crontab -e                           # add this line, save, exit:
30 3 * * * cd /opt/monolith-sports && sh backup.sh >> backups/backup.log 2>&1
```

Copy the backups to your PC now and then (**on your PC**): `scp -r root@SERVER-IP:/opt/monolith-sports/backups "$HOME\Monolith backups"`

To restore the database from a backup (replace the file name):

```sh
cd /opt/monolith-sports
docker compose stop app
docker compose exec -T db pg_restore -U monolith -d monolith --clean --if-exists < backups/db-2026-12-01-0330.dump
docker compose start app
```

and the uploaded files:
`docker run --rm -v monolith_uploads:/data -v "$PWD/backups:/in" alpine sh -c "cd /data && tar xzf /in/uploads-2026-12-01-0330.tgz"`

## 9. Updating the site later

Build a new `monolith-sports.zip` on your PC (`npm run build` and `npm run package` in the project), copy it to
`/opt/` as in step 3, then:

```sh
sh /opt/monolith-sports/update.sh /opt/monolith-sports.zip
```

It backs up first, keeps your `.env`, builds and starts the new version, and keeps the old one beside it. If
something looks wrong: `sh /opt/monolith-sports/rollback.sh`. The database and the uploads are never replaced.

## 10. Optional: Cloudflare in front

Cloudflare adds a CDN, a firewall and rate-limit rules at the edge (DEPLOYMENT.md, step 4). Put the domain's DNS on
Cloudflare with the proxy on and SSL mode **Full (strict)**, then edit `Caddyfile` as its last comment says, so
the site keeps seeing each visitor's real address, and run `docker compose restart caddy`.

---

## When something is wrong

| What you see | What to do |
|---|---|
| `docker compose up` stops with "Set … in .env" | That setting is empty in `.env` |
| The app keeps restarting | `docker compose logs app`: "APP_SECRET is missing" means it is empty or shorter than 32 characters |
| A "502" page | The app is still starting (the first start creates the database tables): wait a minute |
| No certificate / browser warning | DNS (step 1) not yet pointing here, or the firewall (step 2) blocking 80/443 |
| Emails not arriving | Admin > Email outbox shows each one with its status; check the Resend domain is verified |
| The server ran out of disk | `docker system df`, then `docker image prune -f`; old backups go after 14 days |

**Never** run the project's end-to-end tests (`npm run test:e2e`) against the live site: they create test inquiries
and accounts in the real database.
