import { NextResponse } from 'next/server';
import { inquirySchema, fieldErrors } from '@/lib/inquiry/validation';
import { createInquiry } from '@/lib/inquiry/create';
import { checkFile, UploadError, type CheckedFile } from '@/lib/security/upload';
import { rateLimit, LIMITS } from '@/lib/security/rate-limit';
import { sameOrigin, keyFrom, clientIpFrom, countryFrom } from '@/lib/security/request';
import { verifyTurnstile, filledHoneypot, sentTooFast } from '@/lib/security/turnstile';
import { readSession } from '@/lib/auth/session';

/* POST /api/inquiries (multipart/form-data): one consolidated quote, sample, distributor, partnership or
   contact inquiry. Fields: see src/lib/inquiry/validation.ts; `items` is a JSON array; `files` up to 5.
   200 { reference } · 400 { errors } · 403 cross-site · 429 rate limited. Documented in docs/API.md. */

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-site request refused.' }, { status: 403 });
  const key = keyFrom(req.headers);
  const rl = rateLimit(`inq:${key}`, LIMITS.inquiry);
  if (!rl.ok) return NextResponse.json({ error: `Too many requests. Try again in ${Math.ceil(rl.retryAfter / 60)} minutes.` }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Send the form as multipart/form-data.' }, { status: 400 }); }
  // a bot that filled the hidden field gets a normal-looking answer and nothing is stored
  if (filledHoneypot(form)) return NextResponse.json({ reference: 'MS-000000-00000' });
  if (sentTooFast(form)) return NextResponse.json({ errors: { form: 'That was very quick. Check the form, then send it again.' } }, { status: 400 });
  if (!(await verifyTurnstile(form.get('cf-turnstile-response') as string | null, clientIpFrom(req.headers)))) {
    return NextResponse.json({ errors: { form: 'The spam check failed. Reload the page and send the form again.' } }, { status: 400 });
  }

  let items: unknown = [];
  try { items = JSON.parse(String(form.get('items') || '[]')); } catch { items = []; }
  const parsed = inquirySchema.safeParse({
    type: form.get('type') || 'quote',
    companyName: form.get('companyName'), contactName: form.get('contactName'), email: form.get('email'),
    phone: form.get('phone') ?? '', country: form.get('country') ?? '', currency: form.get('currency') || 'EUR',
    branding: form.get('branding') ?? '', packaging: form.get('packaging') ?? '', targetDate: form.get('targetDate') ?? '',
    shippingMethod: form.get('shippingMethod') ?? '', message: form.get('message') ?? '', items,
    locale: form.get('locale') || 'en', sourcePage: form.get('sourcePage') ?? '',
  });
  if (!parsed.success) return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 400 });

  const uploads = form.getAll('files').filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f && (f as File).size > 0);
  if (uploads.length > 5) return NextResponse.json({ errors: { files: 'Attach at most 5 files.' } }, { status: 400 });
  const checked: CheckedFile[] = [];
  try {
    for (const f of uploads) checked.push(await checkFile(f, 'artwork'));
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ errors: { files: e.message } }, { status: 400 });
    throw e;
  }

  const user = await readSession('customer');
  const result = await createInquiry(parsed.data, checked, {
    userId: user?.emailVerifiedAt ? user.id : undefined,
    companyId: user?.emailVerifiedAt ? user.companyId : null,
    country: countryFrom(req.headers),
  });
  return NextResponse.json({ reference: result.reference, type: result.type });
}
