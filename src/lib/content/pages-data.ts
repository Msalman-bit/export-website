/* Seed copy for the content pages. Format (rendered by src/components/RichText.tsx, never as raw HTML):
   "## Heading", blank-line paragraphs, "- " list items, [label](/path) links (the locale is added),
   and a line "[[cta:Label|/path]]" for one button. Pages marked draft are unpublished until the owner
   supplies and confirms the facts named in reviewNote (Admin > Pages). */

export type SeedPage = {
  slug: string; section: 'company' | 'manufacturing' | 'support' | 'legal';
  title: string; summary: string; body: string;
  status?: 'draft' | 'published'; needsReview?: boolean; reviewNote?: string; image?: string;
};

export const PAGES: SeedPage[] = [
  {
    slug: 'about', section: 'company', image: 'intro-stitching',
    title: 'About Monolith Sports',
    summary: 'A Pakistani manufacturer and exporter of sports equipment, made under the buyer’s brand for clubs, distributors and brands abroad.',
    body: `Monolith Sports makes and sources sports equipment in Pakistan for businesses in Europe and North America. We work from your design, a reference product or a written brief, and we deliver the order under your brand.

## What we make
Footballs and football equipment, rugby and cricket equipment, combat-sports and fitness gear, racket-sports accessories, sportswear and training accessories. The [catalogue](/products) lists every product family we quote.

## How an order runs
- You send an inquiry with the products, quantities and branding you need.
- We reply with a quotation in EUR, GBP or USD.
- We make a sample; production starts after you approve it.
- The bulk order is made and inspected against that sample, then packed and shipped.

## Who we work with
Professional clubs, academies, schools and universities, sports associations, retailers, distributors, importers, fitness businesses and private-label brands. We do not sell to individual players.

[[cta:Request a quote|/inquiry]]`,
  },
  {
    slug: 'company-history', section: 'company', status: 'draft', needsReview: true,
    reviewNote: 'Add the founding year, the founders, where the company started and three to five real milestones. Publish only facts you can document.',
    title: 'Company history',
    summary: 'How Monolith Sports started and how it grew.',
    body: `## Where we started
The owner adds the founding year, the founders and the first products here.

## Milestones
The owner adds real milestones here: the first export order, new product families, new premises.`,
  },
  {
    slug: 'mission-vision', section: 'company', needsReview: true,
    reviewNote: 'Confirm the wording of the mission and vision with the owner.',
    title: 'Mission and vision',
    summary: 'What Monolith Sports is for, and what it is working towards.',
    body: `## Our mission
To make sports equipment to the buyer’s specification and deliver the bulk order exactly as the approved sample, with every step written down: the quotation, the sample, the inspection and the shipment.

## Our vision
To be the supplier that clubs, distributors and private-label brands in Europe call first for any product family, from match footballs to teamwear, through one inquiry and one contact.

## What that means in practice
- One quotation can cover every product family you buy.
- The approved sample is the reference for production and inspection.
- Commercial terms, currencies and lead times are written into the quotation, not promised in advance.`,
  },
  {
    slug: 'manufacturing', section: 'manufacturing', image: 'process-prototype',
    title: 'Manufacturing capabilities',
    summary: 'The product families we make and source, the constructions we work in, and how an order moves through production.',
    body: `Monolith Sports manufactures and sources across eight product families: football, rugby, cricket, combat sports, fitness, racket sports, sportswear and accessories. Each [product page](/products) lists the constructions and branding methods you can ask for.

## Constructions
- Footballs: thermally bonded, hand-stitched, machine-stitched and hybrid builds.
- Gloves: cut and sewn, with latex, leather or synthetic palms.
- Sportswear: cut and sewn, with sublimation, embroidery, screen print and heat transfer.
- Protective gear: moulded shells and padded, sewn constructions.

## Order stages
Research and development, material selection, product design, prototyping, manufacturing, quality inspection, packaging and international shipment. You approve the design and the sample before production starts.

## What we confirm in the quotation
Minimum order quantity, production lead time and the tests that apply to your product and market are confirmed per order in the quotation, because they change with the specification.

[[cta:Request a quote|/inquiry]]`,
  },
  {
    slug: 'factory', section: 'manufacturing', needsReview: true, image: 'process-materials',
    reviewNote: 'Add the factory location (town), the floor area, the production lines and real photographs of the facility. Do not publish generated factory imagery.',
    title: 'Factory and facilities',
    summary: 'How to see where your order is made: a facility profile, a visit or a video walk-through.',
    body: `Buyers who place repeat or private-label orders often want to see where the work is done. Ask for any of the following in your inquiry:

- A facility profile: the production steps done in-house and the ones subcontracted for your product.
- A visit to the production floor, arranged around your sample approval.
- A live video walk-through for buyers who cannot travel.
- An audit by an inspection company you appoint.

[[cta:Request a facility profile|/contact]]`,
  },
  {
    slug: 'quality-control', section: 'manufacturing', needsReview: true, image: 'process-inspection',
    reviewNote: 'Confirm the inspection points and whether in-house test equipment exists for each product family.',
    title: 'Quality control',
    summary: 'Every lot is checked against the sample you approved. Here is what the inspection covers and how certificates are shown.',
    body: `The approved sample is the reference for your order. Production is checked against it during manufacture and again before packing.

## What the inspection covers
- Dimensions and weight against the approved sample.
- Stitching, bonding and seam finish.
- Print and embroidery: position, colour and adhesion.
- Packing count, labels and carton marks.

## Your own inspection
You may appoint an independent inspection company to check the order before shipment. Tell us in your inquiry and we plan the production schedule around it.

## Certificates and test standards
We list a certificate on this site only when its document is published here. Which tests apply depends on the product and the market it is sold in; tell us your market and the quotation names the tests and who carries them out.`,
  },
  {
    slug: 'research-development', section: 'manufacturing', needsReview: true, image: 'process-materials',
    reviewNote: 'Confirm the development steps and add any real development projects the owner wants to show.',
    title: 'Research and development',
    summary: 'How a new product is developed: from a brief to a drawing, a material choice and a sample you can test.',
    body: `New products start with how they will be used: who plays, on what surface, how often, and in which market they are sold.

## Development steps
- Brief: you describe the product, its users and its price point.
- Materials: we propose outer materials, linings and fillings that fit the use.
- Design: we draw the product with your branding for sign-off.
- Prototype: we make a sample in the chosen materials.
- Revision: your feedback goes into a second sample when needed.

Development work is quoted with the order it leads to. Send your brief through the [inquiry form](/inquiry).`,
  },
  {
    slug: 'oem-manufacturing', section: 'manufacturing', image: 'process-prototype',
    title: 'OEM manufacturing',
    summary: 'We make the product to your design and specification, under your brand.',
    body: `In OEM manufacturing the design is yours. You send the drawings, the technical specification or a reference product, and we make it to that specification under your brand.

## What to send
- Drawings or a tech pack, with measurements and tolerances.
- Materials and colours, with Pantone references where you have them.
- Logo and artwork files (PDF, AI or EPS preferred).
- Quantities per size and per colour.
- Packaging and labelling requirements.

## What you receive
A quotation with the price per unit at your quantities, the sample cost and the lead time, then a sample for approval before production.

[[cta:Request a quote|/inquiry]]`,
  },
  {
    slug: 'odm-manufacturing', section: 'manufacturing',
    title: 'ODM manufacturing',
    summary: 'Start from a product in our catalogue, change its specification and sell it under your brand.',
    body: `In ODM manufacturing you start from one of our product types instead of a full design of your own. You choose the construction, materials and colours, add your branding, and we develop it into your product.

## How it works
- Pick a product type from the [catalogue](/products).
- Tell us what to change: materials, colours, panel layout, sizes.
- Add your logo and packaging.
- Approve the sample; we produce the order.

ODM suits brands that want their own product without a design team, and distributors adding a private range.

[[cta:Request a quote|/inquiry]]`,
  },
  {
    slug: 'private-label', section: 'manufacturing', image: 'custom-embroidery',
    title: 'Private labelling',
    summary: 'Products made and packed under your brand, with your labels, swing tags and cartons.',
    body: `Private labelling puts your brand on every part of the product a customer sees: the product itself, its labels and its packaging.

## What can carry your brand
- The product: print, embroidery, embossing or sublimation.
- Labels: woven labels, care and size labels, swing tags.
- Packaging: polybags, retail boxes, header cards and carton marks.

## Barcodes and retail requirements
Send your barcodes and your retailer’s packing instructions with the inquiry, and they are applied in production.

[[cta:Request a quote|/inquiry]]`,
  },
  {
    slug: 'custom-development', section: 'manufacturing', image: 'custom-football',
    title: 'Custom product development',
    summary: 'For a product that is not in our catalogue: from your idea to a sample.',
    body: `If what you need is not in the catalogue, describe it. Custom development runs through the same stages as any order, with more time on design and samples.

- Describe the product and who will use it.
- Send sketches, photographs or a reference product.
- We propose materials and a construction.
- We make a sample and revise it with you.

Use the [customisation studio](/studio) to try colours and logo placement on a football, glove or shirt before you write the brief.

[[cta:Request a quote|/inquiry]]`,
  },
  {
    slug: 'sustainability', section: 'company', needsReview: true,
    reviewNote: 'Add measured figures (energy, material, waste) only when they exist. Confirm which lower-impact options production can offer.',
    title: 'Sustainability',
    summary: 'The choices that change an order’s footprint, and how we report on them.',
    body: `We publish environmental figures on this page only once they are measured. Until then, these are the choices that change the footprint of an order, and you make them in your inquiry:

## Freight
Sea freight instead of air freight for orders that are not urgent, and consolidated shipments when you order several product families at once.

## Packaging
Bulk cartons instead of single retail boxes where your sales channel allows, and packaging without single-use plastic on request.

## Materials
Ask in your inquiry for recycled polyester in sportswear or other lower-impact materials; the quotation states what is possible for your product.

## Product life
Training equipment built for the surface it is used on lasts longer: tell us how and where the products will be used.`,
  },
  {
    slug: 'ethical-sourcing', section: 'company', status: 'draft', needsReview: true,
    reviewNote: 'Publish only after the owner confirms the labour policy, the audit history and any certification. Sialkot buyers often ask about child-labour monitoring: answer with documented facts.',
    title: 'Ethical sourcing',
    summary: 'Labour standards, subcontracting and audits.',
    body: `## Labour standards
The owner states the company’s labour policy here: minimum working age, working hours, wages and how they are monitored.

## Subcontracting
Which steps of production are subcontracted, and how subcontractors are checked.

## Audits
Audits carried out, by whom and when, with the documents available to buyers.`,
  },
  {
    slug: 'global-exports', section: 'company',
    title: 'Global exports',
    summary: 'Where we ship, how quotations handle currency and delivery, and what export documents come with an order.',
    body: `Monolith Sports exports to businesses in Ireland, the United Kingdom, the European Union, Norway, Switzerland and North America. The [map on the home page](/#markets) marks our target markets.

## Currencies
Quotations are issued in EUR, GBP or USD; choose one on the inquiry form.

## Delivery terms
Delivery terms (Incoterms) are agreed per order and written into the quotation: delivered to your forwarder, to the port, or to your door.

## Documents
Commercial invoice, packing list and the certificate of origin your customs broker asks for are prepared with each shipment.

[[cta:Request a quote|/inquiry]]`,
  },
  {
    slug: 'shipping-logistics', section: 'support', image: 'process-packing',
    title: 'Shipping and logistics',
    summary: 'Sea freight, air freight and courier, packed to your instructions and tracked in your customer portal.',
    body: `## Shipping methods
- Sea freight: the lowest cost per unit for full orders.
- Air freight: for urgent orders and top-ups.
- Courier: for samples and small orders.

Choose a preferred method on the inquiry form; the quotation prices the method you choose and names the alternative.

## Packing
Products are packed to your instructions: by size, by player, or in retail packaging, with your carton marks.

## Tracking
Once an order ships, the carrier and tracking number appear in your [customer portal](/account).`,
  },
  {
    slug: 'sample-ordering', section: 'support', image: 'process-prototype',
    title: 'Sample ordering',
    summary: 'How to order a sample before your bulk order, what it costs and how approval works.',
    body: `A sample shows the product in your materials, colours and branding before you commit to the bulk order.

## How to order a sample
- Open any product page and choose Request a sample, or add the product to your inquiry and tick “sample first”.
- The quotation lists the sample cost, the time to make it and the courier cost.
- Approve the sample in writing, or send your changes for a second sample.

## Why approval matters
The approved sample is the reference for production and for the inspection before shipment.

[[cta:Request a sample|/inquiry?type=sample]]`,
  },
  {
    slug: 'faq', section: 'support',
    title: 'Frequently asked questions',
    summary: 'Answers on orders, samples, currencies, branding and certificates.',
    body: `## Do you sell to individual players?
No. We supply businesses: clubs, academies, schools, retailers, distributors and brands.

## Can I order a sample before the bulk order?
Yes. Request a sample from any product page; the quotation lists its cost and lead time.

## Which currencies do you quote in?
EUR, GBP or USD. Choose one on the inquiry form.

## What is your minimum order quantity?
It is set per product and depends on the specification; your quotation states it.

## Can you make a product to my own design?
Yes. Send drawings, a reference product or a written brief, and we develop it with you (OEM and ODM).

## Which files do you need for my logo?
Vector files (PDF, AI or EPS) work best. PNG or JPG at a high resolution is fine for a first quotation.

## Are your products certified?
A certificate is listed on this site only once its document is published here. Tell us your market and the quotation names the tests that apply.

## How do I follow my order?
Create a [customer account](/account/register) with the email you used for your inquiry: quotations, production status and tracking appear there.`,
  },
  {
    slug: 'partnerships', section: 'company',
    title: 'Partnership opportunities',
    summary: 'Long-term supply, co-development and representation partnerships for businesses in our markets.',
    body: `We work with partners who buy or sell across several product families and seasons.

## Supply partnerships
Planned seasonal orders with agreed production slots and reorder terms.

## Co-development
Joint development of a product line under your brand, from brief to range.

## Representation
Agents and sourcing offices in Europe who represent Monolith Sports to clubs and retailers.

Tell us about your business with the form below.`,
  },
  {
    slug: 'become-a-distributor', section: 'company',
    title: 'Become a distributor',
    summary: 'Distribute Monolith Sports products in your country or region.',
    body: `Distributors buy across our product families and sell to clubs, schools and retailers in their region.

## What we look for
- An existing customer base among clubs, schools or sports retailers.
- Warehousing and delivery in your region.
- A plan for the product families you want to carry.

## What to tell us
Your company, the region you cover, the customers you sell to and the products you want to carry. We reply with terms for your region.`,
  },
  {
    slug: 'contact', section: 'support',
    title: 'Contact',
    summary: 'Write to the Monolith Sports sales team. For prices, use the quotation form so every product is in one request.',
    body: `For prices and quotations, the [inquiry form](/inquiry) collects everything a quotation needs in one request. For anything else, write to us here.`,
  },
  {
    slug: 'privacy', section: 'legal', needsReview: true,
    reviewNote: 'Legal review required before launch: name the data controller, its address and the lawful bases with a qualified adviser (GDPR and UK GDPR).',
    title: 'Privacy policy',
    summary: 'What personal data this site collects, why, how long it is kept and your rights.',
    body: `This policy explains how Monolith Sports handles personal data collected through this website.

## What we collect
- Inquiry and quotation requests: company name, contact name, business email, phone number, country, the products you ask about and any files you attach.
- Customer accounts: name, business email, company details and a hashed password. We never store passwords in readable form.
- Newsletter: your email address and language.
- Usage counts: pages and products viewed and forms submitted, counted without cookies and without storing your IP address.
- Analytics cookies: only if you accept them (see the [cookie policy](/cookies)).

## Why we use it
To answer inquiries, prepare quotations and fulfil orders (contract), to run customer accounts (contract), to send the newsletter (consent), and to keep the site secure (legitimate interest).

## How long we keep it
Inquiries without an order: 24 months. Orders and invoices: as long as tax law requires. Newsletter: until you unsubscribe. Accounts: until you ask us to close them.

## Who receives it
Our email delivery and hosting providers, under data-processing agreements, and carriers for shipments. We do not sell personal data.

## Your rights
You can ask for a copy of your data, correction, deletion, restriction or portability, and you can object to processing. Write to us through the [contact page](/contact). You may also complain to your data protection authority.`,
  },
  {
    slug: 'cookies', section: 'legal', needsReview: true,
    reviewNote: 'Legal review required before launch (ePrivacy / PECR).',
    title: 'Cookie policy',
    summary: 'Which cookies this site sets, and how to change your choice.',
    body: `## Cookies that are always on
- Session cookie: keeps you signed in to your customer account. Deleted when you sign out or after 14 days.
- Preference cookie: remembers your cookie choice for 12 months.

Your inquiry list is kept in your browser’s local storage, not in a cookie, and is never sent to us until you submit it.

## Cookies you choose
- Analytics (Google Analytics 4): counts visits and the pages they include. Set only after you accept analytics. It is off by default.

## Change your choice
Use the setting below at any time. Withdrawing consent removes the analytics cookies on your next page view.`,
  },
  {
    slug: 'terms', section: 'legal', needsReview: true,
    reviewNote: 'Legal review required before launch: governing law, liability and the terms of sale used in quotations.',
    title: 'Terms and conditions',
    summary: 'The terms for using this website. Terms of sale are set out in each quotation.',
    body: `## This website
This website presents Monolith Sports products and services to businesses. Product pages describe product types; the specification of your order is the one confirmed in your quotation and approved sample.

## Quotations and orders
A quotation is an offer valid until the date printed on it. An order is confirmed only when both parties accept the quotation in writing. Payment terms, delivery terms and lead times are those in the quotation.

## Customisation previews
Previews made in the customisation studio are visual concepts. Colours on screen differ from printed and dyed materials; the approved sample is the production reference.

## Your files
You confirm that you have the right to use the logos and artwork you send us, and you allow us to use them only to quote and produce your orders.

## Accounts
Keep your password private. We may suspend an account that is used to access another company’s information.`,
  },
  {
    slug: 'accessibility', section: 'legal',
    title: 'Accessibility statement',
    summary: 'The standard this website aims for, how it was checked and how to report a problem.',
    body: `We aim for this website to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.

## What we did
- Every page works with a keyboard alone, with a visible focus ring.
- Text meets contrast ratios of 4.5:1 or more.
- Images carry text alternatives; decorative images are hidden from screen readers.
- Forms have visible labels, and errors are announced and shown under the field they belong to.
- Animation stops when your system asks for reduced motion.

## Known limits
The 3D football in the customisation studio cannot be fully described to a screen reader; every choice made in it is also available as a standard form control, and the 2D view shows the same design.

## Report a problem
Tell us through the [contact page](/contact) which page and what went wrong, and we will reply.`,
  },
];

export const ARTICLES = [
  {
    slug: 'thermally-bonded-vs-hand-stitched-footballs',
    title: 'Thermally bonded or hand-stitched: choosing a football construction',
    summary: 'How the three main football constructions differ, and which one fits training, matches and promotional orders.',
    author: 'Monolith Sports',
    body: `A football’s construction decides how its panels are joined, and that changes how the ball feels, how it wears and what it costs.

## Hand-stitched
Panels are sewn by hand from the inside with waxed thread. The seams sit deep and tight, and the ball keeps its shape well under heavy use. Hand stitching takes longer, which shows in the unit price.

## Machine-stitched
Panels are sewn by machine from the outside. The seams are shallower and the ball costs less, which suits schools, events and promotional orders at volume.

## Thermally bonded
Panels are bonded to the carcass with heat and adhesive, with no stitch holes. The surface is closed and smooth, which helps the ball keep its shape and take on less water. Panel shapes are free of the classic 32-panel pattern.

## Hybrid
A stitched outer over bonded or laminated inner layers combines a stitched seam with a closed lining.

## Which to choose
- Daily training on artificial turf: machine- or hand-stitched with a hard-wearing outer.
- Matches: thermally bonded or hand-stitched.
- Promotional runs: machine-stitched or mini balls.

Tell us how the ball will be used in your [inquiry](/inquiry) and the quotation proposes the construction.`,
  },
  {
    slug: 'private-label-football-brief',
    title: 'What to put in a private-label football brief',
    summary: 'The eight things a manufacturer needs to quote a private-label ball accurately the first time.',
    author: 'Monolith Sports',
    body: `A complete brief gets you an accurate quotation on the first reply. These are the eight things to include.

## 1. Use
Who plays with it, on what surface, and how often.

## 2. Size and quantity
Sizes and the quantity of each. Volumes change the price per unit.

## 3. Construction
Thermally bonded, hand-stitched, machine-stitched or hybrid, or ask us to propose one.

## 4. Outer material
PU, PVC or TPU, or the feel you want if you are not sure.

## 5. Panel design and colours
A drawing of the panels with Pantone references where you have them.

## 6. Logo files
Vector files (PDF, AI or EPS) for every logo and graphic.

## 7. Packaging
Polybag, retail box, mesh bag or bulk carton, and any barcodes or retailer instructions.

## 8. Delivery
The destination, the date you need the goods, and sea or air freight.

You can enter every one of these in the [inquiry form](/inquiry), and try colours in the [customisation studio](/studio) first.`,
  },
];
