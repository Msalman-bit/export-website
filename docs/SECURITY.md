# Security report

State at handover. Tested items are covered by `tests/unit/security.test.ts` and `tests/e2e/journey.test.mjs`.

| Control | Implementation | Status |
| --- | --- | --- |
| HTTPS and HSTS | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in production (next.config.ts); `upgrade-insecure-requests` in the CSP | Done; HTTPS itself is the host's (Vercel, Caddy, Cloudflare) |
| Content-Security-Policy | Per-request nonce from `src/proxy.ts`; scripts only from self, the nonce, Google Tag Manager and Turnstile; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` | Tested |
| Other headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `X-Powered-By` off | Tested |
| Passwords | scrypt (N=2^15, r=8, p=1, 64-byte key, 16-byte salt), NFKC-normalised; 12+ characters and not letters only; a dummy hash when the account does not exist, so timing does not reveal accounts | Tested |
| Sessions | Random 256-bit token in an `HttpOnly`, `Secure` (production), `SameSite` cookie; only its SHA-256 is stored; 14 days for customers, 12 hours for staff (`SameSite=Strict`); all sessions ended on password reset or staff disable | Done |
| Staff multifactor | TOTP (RFC 6238) required for every staff account; the secret is AES-256-GCM encrypted with `APP_SECRET`; a staff session counts only after the code | Tested (RFC vectors) |
| Step-up for destructive actions | Deleting an inquiry or a product, and resetting the analytics (administrators only), need the current authenticator code on top of the signed-in session; a code confirms one action only; five wrong codes lock it for 15 minutes; refusals, deletions and resets are audited. Spent codes and the lock are held in memory: several server instances need a shared store (Redis) | Tested (unit, e2e) |
| Account lockout | Customers: 10 failures lock 15 minutes; staff: 6 failures lock 30 minutes; rate limits per address and per email | Done |
| Role-based access | Staff roles admin, sales, content, production (src/lib/auth/rbac.ts); every admin page and action checks its permission; customers can never reach /admin (separate session kind) | Tested |
| Tenant isolation | Every portal query filters by the signed-in user's `companyId`; PDFs and files re-check ownership; inquiries attach to a company only after the email is verified | Done, e2e checks closed routes |
| CSRF | Server Actions: Next.js origin check; route handlers: `sameOrigin()` on every POST; cookies `SameSite` | Tested |
| SQL injection | Drizzle query builder with bound parameters only; no string-built SQL with input | Done |
| XSS | React escaping; CMS text is parsed into elements (never `dangerouslySetInnerHTML`); JSON-LD escapes `<`; emails escape input; uploaded SVG refused; studio logos are rasterised to PNG; the email preview iframe is sandboxed | Tested |
| Input validation | Zod schemas on every endpoint and action; lengths, enums, number ranges, file counts | Tested |
| File uploads | Extension allow-list and the first bytes must match the type; size caps (10 MB artwork, 20 MB documents, 60 MB media); random stored names outside `public/`; served with `nosniff`, `Content-Disposition`, a locked-down CSP, and per-owner access checks; path traversal refused | Tested |
| Spam | Honeypot field, minimum fill time, rate limits; Cloudflare Turnstile when keys are set | Done |
| Rate limiting | Login, registration, reset, inquiry, newsletter, uploads, events (in memory per instance; add Cloudflare rules for several instances) | Tested |
| Audit log | Staff sign-ins (and failures), every write, status change, email, export; customer sign-ins and resets | Done |
| Secrets | Server-only environment variables; nothing secret reaches the browser bundle; `.env*` ignored by git | Done |
| CSV export | Cells starting with `= + - @` are prefixed so spreadsheets never run them | Done |
| Privacy | No analytics cookie before consent; first-party counts store no IP and no identifier; consent revocable on /cookies | Done |
| Dependencies | `npm run audit:deps`; pinned versions; install scripts blocked by npm 12 except where approved | Pending: run on each release |
| Backups and monitoring | docs/MAINTENANCE.md | External: the host's |

Open items before launch:
- Rotate the Kie AI key (shared in chat during the build) and keep media generation keys out of production.
- Run a dependency audit and an external scan (OWASP ZAP baseline) against staging.
- Legal review of privacy, cookie and terms pages; confirm the data-processing agreements (Resend, host, database).
- Multi-instance deployments: move rate limits to Redis or Cloudflare rules.
