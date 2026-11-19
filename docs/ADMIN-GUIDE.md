# Administrator guide

Sign in at `/admin/login` with your email and password, then the six-digit code from your authenticator
app. The first time, the site shows a QR code to scan. Lost your phone? Another administrator uses
**Staff and roles > Reset two-factor**.

## Daily work: inquiries

1. **Dashboard** shows new inquiries. Every request arrives as "New inquiry", whatever its type: the **Type**
   column says quote, sample, distributor, partnership or contact, and a sample request's lines say "Sample
   first". Open one.
2. Read the products, quantities, files (click to download) and the buyer's notes. Studio designs show
   their colours, logo placement and options under the product line.
3. **Status > Move to** "Under review". Tick "Email the customer" to send the note and show it in their
   account; leave it unticked for internal moves.
4. **Prepare a quotation:** the lines are filled from the inquiry; type unit prices, shipping, payment
   terms, Incoterm, lead time, validity. **Save the draft**, then **Preview the PDF**.
5. **Send** emails the buyer and moves the inquiry to "Quotation sent".
6. When the buyer accepts: **Accepted: create the order**. If the inquiry came from someone without an
   account, first **Create the customer company from this inquiry**: the buyer then sees everything after
   registering with the same email.
7. When the buyer says no: **Mark declined**. The quotation stays on record as declined, and you can prepare
   a revised one on the same inquiry.

**Deleting a quotation** (administrators only; sales staff do not see the control). Only a draft, or a
declined quotation without an order, can be deleted: a sent quotation must be marked declined first, and an
accepted one (it belongs to an order and its invoice) can never be deleted. Click **Delete…** under the
quotation; the warning "Delete quotation Q-…? This can't be undone." opens, and only its **Delete Q-…** button
deletes. The audit log records who deleted which quotation and when, with its number, status, total and
inquiry, and the inquiry's timeline notes it. If no quotation is left, the inquiry steps back to "Under
review". Numbers are never reused: the next quotation always takes a new number, so a number a buyer has on
file stays unique.

**Deleting an inquiry** (administrators only; other roles do not see the control). Use it for a test request or
spam, never to tidy away real business. At the foot of the inquiry page, **Delete the inquiry > Delete…** opens the
warning "Delete inquiry MS-…? This can't be undone." with what goes with it. Then type the six-digit code your
authenticator app shows now and click **Delete MS-…**: being signed in is not enough, and each code deletes once
only (for the next deletion, wait for the next code). Five wrong codes lock deleting for 15 minutes. It removes the
inquiry with its product lines, uploaded files, timeline and any draft or declined quotations, and it disappears
from the buyer's account. The analytics and dashboard counts stay as they are: only **Reset the analytics**
changes them. Emails already sent stay in the email outbox, and the buyer's account and messages stay.
It is refused while an order was made from the inquiry (orders and invoices stay on record) or while a quotation is
sent (mark it declined first). The audit log records who deleted which inquiry and when, with its reference,
company, email and quotation numbers, and every refused attempt with a wrong or reused code.

The eleven stages: New inquiry, Under review, Quotation prepared, Quotation sent, Sample requested, Sample
approved, Order confirmed, In production, Quality inspection, Shipped, Completed. You can move forward any
number of steps, or back one.

## Orders and production

**Orders and production > an order:** set the production stage (the customer sees the timeline and gets an
email), add shipments with a tracking link, and issue invoices (PDF for the customer, mark paid or void).

## Customers

Company details, accounts, internal notes, messages (the customer gets an email and reads them in the
portal), and their documents. **Documents** shares a file with one company, all signed-in customers, or
everyone (the Catalogues page).

## Catalogue

- **Categories:** publish only families and types you genuinely supply; unpublished ones vanish everywhere.
  - **A new family** (for example "Basketball equipment"): **Add a family** at the top of the page. Give it a
    name, a one-line summary and a picture for its tile. Its web address comes from the name
    (`/products/basketball-equipment`) and never changes; menus show it without the word "equipment".
  - **A new product type:** open a family's product types and use **Add a product type** at the bottom.
  - New ones start **hidden**. Add the types, then their products (Products, New product: the type list is
    grouped by family and marks hidden ones), then tick **Published** on the type and on the family and save.
  - **Change the picture** under a family replaces its tile picture; one uploaded there before is deleted.
  - **Delete this empty …** appears only on a family with no types or a type with no products: the way to
    fix a misspelt new name. Anything holding products is refused.
- **Products:** every commercial field is editable. Leave a field empty rather than guess: the site then
  says "Confirmed in your quotation". Lists take one item per line; "More specifications" takes
  `Label: value` per line. Upload photographs on the product page; remove concept pictures once real ones exist.
- **Media library:** files with a fixed address (`/media/…`), for example a brand film.

## Content

- **Pages and SEO:** the text format is "## Heading", blank lines between paragraphs, "- " list items,
  `[label](/path)` links and one `[[cta:Label|/path]]` button. Each page has a search title and description.
  "Needs review" marks pages to confirm before launch.
- **Articles:** the Insights blog, same format.
- **Testimonials and certificates:** nothing publishes unless verified (and for testimonials, consented).
- **Business facts:** shown only when verified.
- **Export markets:** mark a country "Shipped to" after a delivery.
- **Translations:** review each interface string per language and tick it; then index the language in
  Settings.

## System

- **Analytics:** product views, inquiry list additions, quotes, samples, downloads, registrations, studio
  use, countries (from the CDN), and the funnel. GA4 adds traffic sources for visitors who accept cookies.
  **Reset the analytics** (administrators only; the dashboard links to it): at the foot of Analytics,
  **Reset…** warns "Reset all analytics counts? This can't be undone.", then takes the six-digit code your
  authenticator app shows now (a code confirms one action only). It deletes every count recorded so far, there and
  on the dashboard, and counting starts again; inquiries, customers, orders and emails are not touched. Use it once,
  before launch, to clear the counts left by testing. The audit log records who reset it, when, and how many of each
  count were removed, and any refused attempt. Nothing else changes the counts: deleting an inquiry or a quotation
  leaves them as they are.
- **Export data:** CSV files for inquiries, lines, quotations, orders, customers, products, subscribers.
- **Email outbox:** every email the site sent or, without a Resend key, would have sent.
- **Staff and roles:** add people (a one-time password to hand over in person), change roles, disable,
  reset two-factor. Roles: Administrator (all), Sales manager, Content editor, Production manager.
- **Settings:** company email, currencies, quotation defaults, languages, analytics.
- **Audit log:** who did what and when (including every deleted quotation and inquiry, and refused deletion codes).
