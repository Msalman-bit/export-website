#!/usr/bin/env node
/* Builds the deployable folder: deploy/monolith-sports (and deploy/monolith-sports.zip on Windows).
     npm run build          (output: 'standalone' in next.config.ts)
     npm run package        (this script)
   The folder is the whole site: copy it to any host with Node.js 22, add a .env (from .env.example) and run
   `node start.mjs`. It carries no secret: every .env* file except .env.example is left out, and the script
   fails if any value from the local .env.local is found anywhere in the folder. */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STANDALONE = path.join(ROOT, '.next', 'standalone');
const OUT = path.join(ROOT, 'deploy', 'monolith-sports');
const ZIP = path.join(ROOT, 'deploy', 'monolith-sports.zip');

if (!fs.existsSync(path.join(STANDALONE, 'server.js'))) {
  console.error('No standalone build found. Run `npm run build` first (next.config.ts has output: "standalone").');
  process.exit(1);
}

const copy = (from, to) => fs.cpSync(from, to, { recursive: true, dereference: true, force: true });
fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(ZIP, { force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1. the server and the dependencies it traced: an allow-list, never the whole standalone folder (Next copies
//    project files into it when a runtime path is built from the working folder, .env.local among them)
for (const name of ['server.js', 'package.json', 'node_modules', '.next']) {
  if (fs.existsSync(path.join(STANDALONE, name))) copy(path.join(STANDALONE, name), path.join(OUT, name));
}
fs.rmSync(path.join(OUT, '.next', 'cache'), { recursive: true, force: true });
// 2. what the standalone build leaves out by design: the browser files, the public folder, the migrations
copy(path.join(ROOT, '.next', 'static'), path.join(OUT, '.next', 'static'));
copy(path.join(ROOT, 'public'), path.join(OUT, 'public'));
copy(path.join(ROOT, 'drizzle'), path.join(OUT, 'drizzle'));
copy(path.join(ROOT, '.env.example'), path.join(OUT, '.env.example'));
copy(path.join(ROOT, 'docs', 'DEPLOYMENT.md'), path.join(OUT, 'DEPLOYMENT.md'));

// 3. nothing local: no env file but the example, no data from this machine
const strip = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' && dir !== OUT) continue;
    const st = fs.lstatSync(p);
    if (st.isDirectory()) { if (['storage', '.taste-skill', 'shots', 'plans', 'media'].includes(name) && dir === OUT) fs.rmSync(p, { recursive: true, force: true }); else strip(p); }
    else if (/^\.env/.test(name) && name !== '.env.example') fs.rmSync(p, { force: true });
  }
};
strip(OUT);

// 4. the launcher: reads .env beside it (values already set by the host win), then starts Next's server
fs.writeFileSync(path.join(OUT, 'start.mjs'), `// Starts the site: node start.mjs  (Node.js 20.9 or newer)
// Reads .env in this folder if it exists (copy .env.example to .env and fill it in). A variable already set by the
// host (a control panel, systemd, Docker) wins over the file. PORT (default 3000) and HOSTNAME (default 0.0.0.0) apply.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
process.chdir(here); // the database, uploads and migrations are found relative to this folder
const env = path.join(here, '.env');
if (fs.existsSync(env)) {
  for (const line of fs.readFileSync(env, 'utf8').split(/\\r?\\n/)) {
    const m = line.match(/^\\s*([A-Z0-9_]+)\\s*=\\s*(.*)\\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^(['"])(.*)\\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
process.env.NODE_ENV = 'production';
process.env.HOSTNAME ||= '0.0.0.0';
if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32) {
  console.error('APP_SECRET is missing or shorter than 32 characters. Set it in .env (see .env.example).');
  process.exit(1);
}
await import('./server.js');
`);

// 5. a container recipe for hosts that run Docker
fs.writeFileSync(path.join(OUT, 'Dockerfile'), `# docker build -t monolith-sports .
# docker run -d -p 3000:3000 --env-file .env -v monolith-data:/app/storage monolith-sports
FROM node:22-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# the local database (when DATABASE_URL is empty) and the uploaded files live here: keep it on a volume. The site
# runs as the unprivileged node user, so the folder is created and owned by it before the volume is mounted.
RUN mkdir -p /app/storage/uploads && chown -R node:node /app/storage
VOLUME ["/app/storage"]
EXPOSE 3000
USER node
CMD ["node", "start.mjs"]
`);
// the image never holds settings, local data, backups or the server-side kit
fs.writeFileSync(path.join(OUT, '.dockerignore'), ['.env', '.env.*', 'storage', 'backups', '*.zip', 'docker-compose.yml', 'Caddyfile', '*.sh', '*.md'].join('\n') + '\n');

// 5a. a one-server setup for a VPS (Hostinger KVM or any Linux server with Docker): the site, PostgreSQL and HTTPS,
//     with backup, update and rollback scripts and the step-by-step guide (deploy-kit/hostinger/HOSTINGER.md)
for (const name of fs.readdirSync(path.join(ROOT, 'deploy-kit', 'hostinger'))) {
  copy(path.join(ROOT, 'deploy-kit', 'hostinger', name), path.join(OUT, name));
}

// 6. the one page to read first
fs.writeFileSync(path.join(OUT, 'START-HERE.md'), `# Monolith Sports: the deployable site

This folder is the whole website: the server, its dependencies, the images and the database migrations.
It needs **Node.js 20.9 or newer** (22 recommended). Nothing else is installed on the server (no \`npm install\`).

**On a Hostinger VPS, or any Linux server with Docker, follow \`HOSTINGER.md\` instead:** one command runs the
site, its PostgreSQL database and HTTPS together (\`docker-compose.yml\`, \`Caddyfile\`, \`.env.hostinger.example\`),
with daily backups (\`backup.sh\`), updates (\`update.sh\`) and a way back (\`rollback.sh\`).

## Run it

1. Copy this folder to the server.
2. Copy \`.env.example\` to \`.env\` and fill it in. At least:
   - \`APP_SECRET\`: 32 or more random characters (\`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"\`)
   - \`SITE_URL\`: the public address, e.g. \`https://www.monolithsports.com\`
   - \`SEED_ADMIN_EMAIL\` and \`SEED_ADMIN_PASSWORD\`: the first admin account, created on the first start
   - \`DATABASE_URL\`: a PostgreSQL 14+ connection string. **Required in production.** Left empty, the site uses
     its built-in database in \`storage/\` here: fine for trying it out or a demo, not for real customers.
   - \`RESEND_API_KEY\`, \`EMAIL_FROM\`, \`ADMIN_NOTIFY_EMAIL\`: so inquiry emails are sent (without them they are
     only logged in Admin > Email outbox).
3. Start it: \`node start.mjs\` (listens on port 3000; set \`PORT\` to change it).
4. Put it behind HTTPS (a reverse proxy such as Caddy or Nginx, or the host's own TLS). The site sends HSTS.
5. Sign in at \`/admin\` with the seed admin and set up two-factor authentication.

With Docker instead: \`docker build -t monolith-sports .\` then
\`docker run -d -p 3000:3000 --env-file .env -v monolith-data:/app/storage monolith-sports\`.

## Keep safe

- \`storage/\` holds the built-in database and every uploaded file (logos, artwork). Keep it on persistent disk
  and back it up (stop the site, copy the folder), or use \`DATABASE_URL\` with a managed PostgreSQL and set
  \`UPLOAD_DIR\` to a persistent path.
- Never put \`.env\` in version control or a public folder.

## Before launch

The content checklist (facts, certificates, photography, the futsal and handball ranges to confirm) is in the
project's \`docs/CONTENT-CHECKLIST.md\`. The full deployment notes are in \`DEPLOYMENT.md\` here.
`);

// 7. the secret check: no value of the local .env.local may appear in any file of the folder
const secrets = [];
const local = path.join(ROOT, '.env.local');
if (fs.existsSync(local)) {
  for (const line of fs.readFileSync(local, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[2].trim().length >= 8 && /SECRET|PASSWORD|KEY|TOKEN/.test(m[1])) secrets.push({ name: m[1], value: m[2].trim() });
  }
}
let files = 0, bytes = 0;
const leaks = [];
const scan = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) { scan(p); continue; }
    files++; bytes += st.size;
    if (st.size > 20 * 1024 * 1024 || /\.(webp|jpg|jpeg|png|mp4|wasm|woff2?|ico)$/i.test(name)) continue;
    const text = fs.readFileSync(p, 'latin1');
    for (const s of secrets) if (text.includes(s.value)) leaks.push(`${s.name} in ${path.relative(OUT, p)}`);
  }
};
scan(OUT);
if (leaks.length) {
  console.error('A local secret was found in the package. Nothing is safe to ship:\n  ' + leaks.join('\n  '));
  process.exit(1);
}
console.log(`deploy/monolith-sports: ${files} files, ${(bytes / 1048576).toFixed(1)} MB; checked for ${secrets.length} local secret value(s): none found`);

// 8. one archive to upload (Windows: Compress-Archive; elsewhere: zip if present)
if (!process.argv.includes('--no-zip')) {
  try {
    if (process.platform === 'win32') {
      execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${OUT}\\*' -DestinationPath '${ZIP}' -Force`], { stdio: 'inherit' });
    } else {
      execFileSync('zip', ['-qr', ZIP, '.'], { cwd: OUT, stdio: 'inherit' });
    }
    console.log(`deploy/monolith-sports.zip: ${(fs.statSync(ZIP).size / 1048576).toFixed(1)} MB`);
  } catch (e) { console.log('zip skipped:', e.message); }
}
