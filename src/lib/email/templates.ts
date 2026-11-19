import { siteUrl } from '../seo';

/* Email templates in the brand's language: obsidian header, white body, one lime rule, Archivo with
   safe fallbacks, tables for old clients. Every template returns html and a plain-text twin. */

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function frame(title: string, bodyHtml: string, action?: { label: string; url: string }) {
  const btn = action
    ? `<tr><td style="padding:8px 32px 32px"><a href="${esc(action.url)}" style="display:inline-block;background:#080808;color:#ffffff;text-decoration:none;font-weight:500;padding:14px 24px;border-radius:4px">${esc(action.label)}</a></td></tr>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#eef0f2;font-family:Archivo,Helvetica,Arial,sans-serif;color:#080808">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f2;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="background:#080808;padding:24px 32px;color:#ffffff;font-size:20px;letter-spacing:-0.01em">Monolith Sports</td></tr>
<tr><td style="height:4px;background:#c5f900;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:32px 32px 8px;font-size:24px;line-height:1.25">${esc(title)}</td></tr>
<tr><td style="padding:8px 32px 16px;font-size:16px;line-height:1.6">${bodyHtml}</td></tr>
${btn}
<tr><td style="padding:24px 32px;border-top:1px solid #e3e5e8;font-size:13px;line-height:1.5;color:#5c5f63">Monolith Sports · Sports equipment made in Pakistan under your brand<br>${esc(siteUrl().replace(/^https?:\/\//, ''))}</td></tr>
</table></td></tr></table></body></html>`;
}

type Line = { name: string; sku: string; quantity: number; notes?: string };

const lineTable = (items: Line[]) => items.length
  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0">${items.map((i) =>
      `<tr><td style="padding:10px 0;border-bottom:1px solid #e3e5e8">${esc(i.name)}<br><span style="color:#5c5f63;font-size:13px">${esc(i.sku)}${i.notes ? ' · ' + esc(i.notes) : ''}</span></td><td align="right" style="padding:10px 0;border-bottom:1px solid #e3e5e8;white-space:nowrap">${i.quantity.toLocaleString('en-GB')} pcs</td></tr>`).join('')}</table>`
  : '';

export function inquiryConfirmation(d: { reference: string; contactName: string; items: Line[]; type: string; locale: string }) {
  const kind = d.type === 'sample' ? 'sample request' : d.type === 'quote' ? 'quotation request' : 'message';
  const title = `We have your ${kind}: ${d.reference}`;
  const html = frame(title,
    `<p>Hello ${esc(d.contactName)},</p><p>Your ${kind} is in. Its reference is <strong>${esc(d.reference)}</strong>; please quote it when you write to us.</p>${lineTable(d.items)}<p>A member of the sales team reviews every request and replies by email. With a customer account you can follow its status and download the quotation.</p>`,
    { label: 'Open your customer account', url: `${siteUrl()}/${d.locale}/account` });
  const text = `${title}\n\nHello ${d.contactName},\n\nYour ${kind} is in. Reference: ${d.reference}.\n\n${d.items.map((i) => `- ${i.name} (${i.sku}): ${i.quantity} pcs`).join('\n')}\n\nA member of the sales team reviews every request and replies by email.\n${siteUrl()}/${d.locale}/account`;
  return { subject: title, html, text };
}

export function inquiryNotification(d: { reference: string; company: string; contactName: string; email: string; country: string; type: string; items: Line[]; message: string; id: string }) {
  const title = `New ${d.type} inquiry ${d.reference} from ${d.company}`;
  const html = frame(title,
    `<p><strong>${esc(d.company)}</strong>, ${esc(d.country)}<br>${esc(d.contactName)} · ${esc(d.email)}</p>${lineTable(d.items)}${d.message ? `<p style="white-space:pre-wrap">${esc(d.message)}</p>` : ''}`,
    { label: 'Open the inquiry', url: `${siteUrl()}/admin/inquiries/${d.id}` });
  const text = `${title}\n\n${d.company} (${d.country})\n${d.contactName} <${d.email}>\n\n${d.items.map((i) => `- ${i.name} (${i.sku}): ${i.quantity}`).join('\n')}\n\n${d.message}\n\n${siteUrl()}/admin/inquiries/${d.id}`;
  return { subject: title, html, text };
}

export function statusUpdate(d: { reference: string; contactName: string; status: string; note: string; locale: string }) {
  const title = `Update on ${d.reference}: ${d.status}`;
  const html = frame(title, `<p>Hello ${esc(d.contactName)},</p><p>Your request ${esc(d.reference)} is now at the stage <strong>${esc(d.status)}</strong>.</p>${d.note ? `<p style="white-space:pre-wrap">${esc(d.note)}</p>` : ''}`,
    { label: 'See it in your account', url: `${siteUrl()}/${d.locale}/account` });
  return { subject: title, html, text: `${title}\n\nHello ${d.contactName},\n\nYour request ${d.reference} is now at the stage: ${d.status}.\n${d.note}\n\n${siteUrl()}/${d.locale}/account` };
}

export function quotationSent(d: { reference: string; number: string; contactName: string; total: string; currency: string; validUntil: string; locale: string }) {
  const title = `Quotation ${d.number} for ${d.reference}`;
  const html = frame(title, `<p>Hello ${esc(d.contactName)},</p><p>Your quotation <strong>${esc(d.number)}</strong> is ready: ${esc(d.currency)} ${esc(d.total)}${d.validUntil ? `, valid until ${esc(d.validUntil)}` : ''}. Download the PDF from your customer account, or reply to this email with questions.</p>`,
    { label: 'Download the quotation', url: `${siteUrl()}/${d.locale}/account/quotations` });
  return { subject: title, html, text: `${title}\n\nHello ${d.contactName},\n\nYour quotation ${d.number} is ready: ${d.currency} ${d.total}. Download it from your account: ${siteUrl()}/${d.locale}/account/quotations` };
}

export function verifyEmail(d: { name: string; url: string }) {
  const title = 'Confirm your email address';
  return {
    subject: title,
    html: frame(title, `<p>Hello ${esc(d.name)},</p><p>Confirm this address to open your Monolith Sports customer account. The link works for 24 hours.</p>`, { label: 'Confirm my email', url: d.url }),
    text: `${title}\n\nHello ${d.name},\n\nConfirm this address to open your customer account (the link works for 24 hours):\n${d.url}`,
  };
}

export function resetEmail(d: { name: string; url: string }) {
  const title = 'Choose a new password';
  return {
    subject: title,
    html: frame(title, `<p>Hello ${esc(d.name)},</p><p>Someone asked to reset the password of your Monolith Sports account. If it was you, choose a new password; the link works for one hour. If not, ignore this email: nothing changes.</p>`, { label: 'Choose a new password', url: d.url }),
    text: `${title}\n\nIf you asked to reset your password, use this link within one hour:\n${d.url}\n\nIf not, ignore this email.`,
  };
}

export function messageNotice(d: { name: string; reference: string; locale: string }) {
  const title = `New message about ${d.reference}`;
  return {
    subject: title,
    html: frame(title, `<p>Hello ${esc(d.name)},</p><p>The sales team wrote to you about ${esc(d.reference)}.</p>`, { label: 'Read the message', url: `${siteUrl()}/${d.locale}/account/messages` }),
    text: `${title}\n\nRead it in your account: ${siteUrl()}/${d.locale}/account/messages`,
  };
}
