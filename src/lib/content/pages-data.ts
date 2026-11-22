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
    summary: 'Monolith Sports manufactures sports equipment in Pakistan for the buyer’s brand and exports it to clubs, distributors and brands abroad.',
    body: `Monolith Sports makes and sources sports equipment in Pakistan for businesses in Europe. We work from your design, a reference product or a written brief, and we deliver the order with your branding.

## Product range
We make and source football, futsal, rugby and handball equipment, combat-sports and fitness equipment, racket-sports accessories, sportswear and training accessories. The [catalogue](/products) lists every product category we quote.

## Order process
- You send an inquiry with the products, quantities and branding you need.
- We reply with a quotation in EUR, GBP or USD.
- We make a sample; production starts after you approve it.
- The bulk order is made and inspected against that sample, then packed and shipped.

## Customers we supply
We supply professional clubs, academies, schools and universities, sports associations, retailers, distributors, importers, fitness businesses and private-label brands. We do not sell to individual players.

[[cta:Request a quotation|/inquiry]]`,
  },
  {
    slug: 'company-history', section: 'company', status: 'draft', needsReview: true,
    reviewNote: 'Add the founding year, the founders, where the company started and three to five real milestones. Publish only facts you can document.',
    title: 'Company history',
    summary: 'How Monolith Sports started and how it grew.',
    body: `## Where we started
The owner adds the founding year, the founders and the first products here.

## Milestones
The owner adds real milestones here: the first export order, new product categories, new premises.`,
  },
  {
    slug: 'mission-vision', section: 'company', needsReview: true,
    reviewNote: 'Confirm the wording of the mission and vision with the owner.',
    title: 'Mission and vision',
    summary: 'The purpose of Monolith Sports and what the company is working towards.',
    body: `## Our mission
Our mission is to make sports equipment to the buyer’s specification and to deliver a bulk order that matches the approved sample exactly, with every step documented: the quotation, the sample, the inspection and the shipment.

## Our vision
Our vision is to be the first supplier that clubs, distributors and private-label brands in Europe contact for any product category, from match footballs to teamwear, through one inquiry and one point of contact.

## How we work
- One quotation can cover every product category you buy.
- The approved sample is the reference for production and inspection.
- Commercial terms, currencies and lead times are confirmed in the quotation.`,
  },
  {
    slug: 'manufacturing', section: 'manufacturing', image: 'process-prototype',
    title: 'Manufacturing capabilities',
    summary: 'The products we make and source, the constructions we use and how an order moves through production.',
    body: `Monolith Sports manufactures and sources products in the following categories: football, futsal, rugby, handball, combat sports, fitness, racket sports, sportswear and accessories. Each [product page](/products) lists the constructions and branding methods you can request.

## Constructions
- Footballs: thermally bonded, hand-stitched, machine-stitched and hybrid builds.
- Gloves: cut and sewn, with latex, leather or synthetic palms.
- Sportswear: cut and sewn, with sublimation, embroidery, screen print and heat transfer.
- Protective gear: moulded shells and padded, sewn constructions.

## Order stages
An order moves through research and development, material selection, product design, prototyping, manufacturing, quality inspection, packaging and international shipment. You approve the design and the sample before production starts.

## Details confirmed in the quotation
Minimum order quantity, production lead time and the tests that apply to your product and market are confirmed per order in the quotation, because they change with the specification.

[[cta:Request a quotation|/inquiry]]`,
  },
  {
    slug: 'factory', section: 'manufacturing', needsReview: true, image: 'process-materials',
    reviewNote: 'Add the factory location (town), the floor area, the production lines and real photographs of the facility. Do not publish generated factory imagery.',
    title: 'Factory and facilities',
    summary: 'How to see where your order is made: a facility profile, a visit or a video walk-through.',
    body: `Buyers who place repeat or private-label orders often want to see where the work is done. Ask for any of the following in your inquiry:

- A facility profile: the production steps carried out in-house and those subcontracted for your product.
- A visit to the production floor, arranged around your sample approval.
- A live video walk-through for buyers who cannot travel.
- An audit by an inspection company you appoint.

[[cta:Request a facility profile|/contact]]`,
  },
  {
    slug: 'quality-control', section: 'manufacturing', needsReview: true, image: 'process-inspection',
    reviewNote: 'Confirm the inspection points and whether in-house test equipment exists for each product family.',
    title: 'Quality control',
    summary: 'Every lot is checked against the sample you approved.',
    body: `The approved sample is the reference for your order. Production is checked against it during manufacture and again before packing.

## Inspection scope
- Dimensions and weight against the approved sample.
- Stitching, bonding and seam finish.
- Print and embroidery: position, colour and adhesion.
- Packing count, labels and carton marks.

## Third-party inspection
You may appoint an independent inspection company to check the order before shipment. Tell us in your inquiry, and we will plan the production schedule around the inspection.

## Certificates and test standards
We list a certificate on this site only when the document itself is published here. The applicable tests depend on the product and the market in which it is sold. Tell us your market, and the quotation will name the tests and who carries them out.`,
  },
  {
    slug: 'research-development', section: 'manufacturing', needsReview: true, image: 'process-materials',
    reviewNote: 'Confirm the development steps and add any real development projects the owner wants to show.',
    title: 'Research and development',
    summary: 'How a new product is developed: from a brief to a drawing, a material choice and a sample you can test.',
    body: `The development of a new product starts with its use: who will use it, on what surface, how often and in which market it will be sold.

## Development steps
- Brief: you describe the product, its users and its price point.
- Materials: we propose outer materials, linings and fillings that fit the use.
- Design: we draw the product with your branding for sign-off.
- Prototype: we make a sample in the chosen materials.
- Revision: your feedback is incorporated into a second sample where needed.

Development work is quoted together with the order that follows. Send your brief through the [inquiry form](/inquiry).`,
  },
  {
    slug: 'oem-manufacturing', section: 'manufacturing', image: 'process-prototype',
    title: 'OEM manufacturing',
    summary: 'We make the product to your design and specification, for your brand.',
    body: `In OEM manufacturing, the design is yours. You send the drawings, the technical specification or a reference product, and we make the product to that specification for your brand.

## Information we need
- Drawings or a tech pack, with measurements and tolerances.
- Materials and colours, with Pantone references where you have them.
- Logo and artwork files (PDF, AI or EPS preferred).
- Quantities per size and per colour.
- Packaging and labelling requirements.

## Quotation and sample
You receive a quotation with the unit price for your quantities, the sample cost and the lead time, followed by a sample for approval before production.

[[cta:Request a quotation|/inquiry]]`,
  },
  {
    slug: 'odm-manufacturing', section: 'manufacturing',
    title: 'ODM manufacturing',
    summary: 'Start from a product in our catalogue, change its specification and sell it as your own brand.',
    body: `In ODM manufacturing, you start from one of our product types rather than a complete design of your own. You choose the construction, materials and colours and add your branding, and we develop it into your product.

## ODM process
- Choose a product type from the [catalogue](/products).
- Tell us what to change: materials, colours, panel layout, sizes.
- Add your logo and packaging.
- Approve the sample, and we produce the order.

ODM suits brands that want their own product without a design team and distributors that are adding a private-label range.

[[cta:Request a quotation|/inquiry]]`,
  },
  {
    slug: 'private-label', section: 'manufacturing', image: 'custom-embroidery',
    title: 'Private labelling',
    summary: 'Products made and packed for your brand, with your labels, swing tags and cartons.',
    body: `With private labelling, your brand appears on every part that the end customer sees: the product itself, its labels and its packaging.

## Branding options
- The product: print, embroidery, embossing or sublimation.
- Labels: woven labels, care and size labels, swing tags.
- Packaging: polybags, retail boxes, header cards and carton marks.

## Barcodes and retail requirements
Send your barcodes and your retailer’s packing instructions with the inquiry, and we will apply them in production.

[[cta:Request a quotation|/inquiry]]`,
  },
  {
    slug: 'custom-development', section: 'manufacturing', image: 'custom-football',
    title: 'Custom product development',
    summary: 'Development of products that are not in our catalogue, from your brief to a sample.',
    body: `If the product you need is not in the catalogue, describe it to us. Custom development follows the same stages as any order, with more time for design and samples.

- Describe the product and who will use it.
- Send sketches, photographs or a reference product.
- We propose materials and a construction.
- We make a sample and revise it with you.

Use the [customisation studio](/studio) to try colours and logo placement on a football, glove or shirt before you write the brief.

[[cta:Request a quotation|/inquiry]]`,
  },
  {
    slug: 'sustainability', section: 'company', needsReview: true,
    reviewNote: 'Add measured figures (energy, material, waste) only when they exist. Confirm which lower-impact options production can offer.',
    title: 'Sustainability',
    summary: 'The choices that affect the environmental footprint of an order and how we report on them.',
    body: `We publish environmental figures on this page only once they are measured. Until then, the following choices affect the footprint of an order, and you can state them in your inquiry.

## Freight
Choose sea freight rather than air freight for orders that are not urgent, and consolidate shipments when you order from several product categories at once.

## Packaging
Choose bulk cartons rather than single retail boxes where your sales channel allows, and request packaging without single-use plastic.

## Materials
Ask in your inquiry for recycled polyester in sportswear or other lower-impact materials; the quotation states what is possible for your product.

## Product life
Training equipment built for the surface it is used on lasts longer, so tell us how and where the products will be used.`,
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
    summary: 'Where we ship, how quotations state currency and delivery terms, and which export documents accompany an order.',
    body: `Monolith Sports exports to businesses in Ireland, the United Kingdom, the European Union, Norway and Switzerland. The [map on the home page](/#markets) marks our target markets.

## Currencies
Quotations are issued in EUR, GBP or USD; choose one on the inquiry form.

## Delivery terms
Delivery terms (Incoterms) are agreed per order and written into the quotation: delivered to your forwarder, to the port or to your premises.

## Documents
The commercial invoice, the packing list and the certificate of origin requested by your customs broker are prepared with each shipment.

[[cta:Request a quotation|/inquiry]]`,
  },
  {
    slug: 'shipping-logistics', section: 'support', image: 'process-packing',
    title: 'Shipping and logistics',
    summary: 'Sea freight, air freight and courier, packed to your instructions and tracked in your customer portal.',
    body: `## Shipping methods
- Sea freight: the lowest cost per unit for full orders.
- Air freight: for urgent and replenishment orders.
- Courier: for samples and small orders.

Choose a preferred method on the inquiry form; the quotation gives the price for that method and names the alternative.

## Packing
Products are packed to your instructions: by size, by player, or in retail packaging, with your carton marks.

## Tracking
Once an order ships, the carrier and tracking number appear in your [customer portal](/account).`,
  },
  {
    slug: 'sample-ordering', section: 'support', image: 'process-prototype',
    title: 'Sample ordering',
    summary: 'How to order a sample before your bulk order, how it is priced and how approval works.',
    body: `A sample shows the product in your materials, colours and branding before you commit to the bulk order.

## How to order a sample
- Open any product page and choose “Request a sample”, or add the product to your inquiry and choose “Samples first” on the inquiry form.
- The quotation lists the sample cost, the time to make it and the courier cost.
- Approve the sample in writing, or send your changes for a second sample.

## Role of the approved sample
The approved sample is the reference for production and for the inspection before shipment.

[[cta:Request a sample|/inquiry?type=sample]]`,
  },
  {
    slug: 'faq', section: 'support',
    title: 'Frequently asked questions',
    summary: 'Answers on orders, samples, currencies, branding and certificates.',
    body: `## Do you sell to individual players?
No. We supply businesses: clubs, academies, schools, retailers, distributors and brands.

## Can we order a sample before the bulk order?
Yes. Request a sample from any product page; the quotation lists its cost and lead time.

## Which currencies do you quote in?
We quote in EUR, GBP or USD. Choose a currency on the inquiry form.

## What is your minimum order quantity?
The minimum order quantity is set per product and depends on the specification. Your quotation states it.

## Can you make a product to our own design?
Yes. Send drawings, a reference product or a written brief, and we will develop the product with you (OEM and ODM).

## Which files do you need for our logo?
Vector files (PDF, AI or EPS) work best. High-resolution PNG or JPG files are sufficient for a first quotation.

## Are your products certified?
We list a certificate on this site only when the document itself is published here. Tell us your market, and the quotation will name the tests that apply.

## How do we track our order?
Create a [customer account](/account/register) with the email address you used for your inquiry. Quotations, production status and tracking appear there.`,
  },
  {
    slug: 'partnerships', section: 'company',
    title: 'Partnership opportunities',
    summary: 'Long-term supply, co-development and representation partnerships for businesses in our markets.',
    body: `We work with partners who buy or sell across several product categories and seasons.

## Supply partnerships
These partnerships cover planned seasonal orders with agreed production slots and reorder terms.

## Co-development
This covers the joint development of a product line for your brand, from brief to range.

## Representation
This is for agents and sourcing offices in Europe that represent Monolith Sports to clubs and retailers.

Tell us about your business with the form below.`,
  },
  {
    slug: 'become-a-distributor', section: 'company',
    title: 'Become a distributor',
    summary: 'Distribute Monolith Sports products in your country or region.',
    body: `Distributors buy across our product categories and sell to clubs, schools and retailers in their region.

## Requirements
- An existing customer base among clubs, schools or sports retailers.
- Warehousing and delivery in your region.
- A plan for the product categories you want to carry.

## Application details
Tell us about your company, the region you cover, the customers you sell to and the products you want to carry. We will reply with terms for your region.`,
  },
  {
    slug: 'contact', section: 'support',
    title: 'Contact',
    summary: 'Contact the Monolith Sports sales team.',
    body: `For prices and quotations, please use the [inquiry form](/inquiry), which collects everything a quotation needs in one request. For any other question, write to us here.`,
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
We use it to answer inquiries, prepare quotations and fulfil orders (contract), to run customer accounts (contract), to send the newsletter (consent) and to keep the site secure (legitimate interest).

## How long we keep it
Inquiries without an order: 24 months. Orders and invoices: as long as tax law requires. Newsletter: until you unsubscribe. Accounts: until you ask us to close them.

## Who receives it
Your data is received by our email delivery and hosting providers, under data-processing agreements, and by carriers for shipments. We do not sell personal data.

## Your rights
You can ask for a copy of your data or for its correction, deletion, restriction or portability, and you can object to processing. Write to us through the [contact page](/contact). You may also complain to your data protection authority.`,
  },
  {
    slug: 'cookies', section: 'legal', needsReview: true,
    reviewNote: 'Legal review required before launch (ePrivacy / PECR).',
    title: 'Cookie policy',
    summary: 'Which cookies this site sets, and how to change your choice.',
    body: `## Cookies that are always on
These are needed for the site to work or to remember a choice you made, so they need no consent.
- Session cookie (ms_session): keeps you signed in to your customer account. Deleted when you sign out or after 14 days.
- Staff session cookie (ms_staff): only for our own team, when signed in to the site’s administration.
- Language cookie (ms_locale): remembers the language you chose, for 12 months.
- Cookie choice (ms_consent): remembers your analytics choice, for 12 months.

## Kept in your browser, not in cookies
These stay on your device in your browser’s local storage. Nothing is sent to us until you submit an inquiry, and you can remove them at any time by clearing this site’s data in your browser.
- Your inquiry list, and whether you are asking for a quotation or for samples.
- Designs you save in the customisation studio (the last 20), if you are not signed in.
- A design’s pictures and your logo, waiting to be attached to your inquiry. They are removed once the inquiry is sent.

We count page and product views without cookies and without storing your IP address.

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
Use the [contact page](/contact) to tell us which page has the problem and what went wrong, and we will reply.`,
  },
];

export const ARTICLES = [
  {
    slug: 'thermally-bonded-vs-hand-stitched-footballs',
    title: 'How to choose a football construction',
    summary: 'How the three main football constructions differ, and which one fits training, matches and promotional orders.',
    author: 'Monolith Sports',
    body: `The construction of a football determines how its panels are joined, which affects how the ball feels, how it wears and what it costs.

## Hand-stitched
Panels are sewn by hand from the inside with waxed thread. The seams sit deep and tight, and the ball keeps its shape well under heavy use. Hand stitching takes longer, which is reflected in the unit price.

## Machine-stitched
Panels are sewn by machine from the outside. The seams are shallower and the ball costs less, which suits schools, events and promotional orders in volume.

## Thermally bonded
Panels are bonded to the carcass with heat and adhesive, with no stitch holes. The surface is closed and smooth, which helps the ball keep its shape and absorb less water. Panel shapes are not limited to the classic 32-panel pattern.

## Hybrid
A hybrid ball has a stitched outer over bonded or laminated inner layers, combining a stitched seam with a closed lining.

## Recommended construction by use
- Daily training on artificial turf: machine- or hand-stitched with a hard-wearing outer.
- Matches: thermally bonded or hand-stitched.
- Promotional runs: machine-stitched or mini balls.

In your [inquiry](/inquiry), tell us how the ball will be used, and the quotation will propose a construction.`,
  },
  {
    slug: 'private-label-football-brief',
    title: 'How to write a private-label football brief',
    summary: 'The eight details a manufacturer needs to quote a private-label ball accurately.',
    author: 'Monolith Sports',
    body: `A complete brief allows us to send an accurate quotation with our first reply. Include the following eight details.

## Use
State who will play with the ball, on what surface and how often.

## Size and quantity
List each size and its quantity. The volume affects the price per unit.

## Construction
Specify thermally bonded, hand-stitched, machine-stitched or hybrid, or ask us to propose a construction.

## Outer material
Specify PU, PVC or TPU, or describe the feel you want if you are not sure.

## Panel design and colours
Send a drawing of the panels, with Pantone references where you have them.

## Logo files
Send vector files (PDF, AI or EPS) for every logo and graphic.

## Packaging
Choose a polybag, retail box, mesh bag or bulk carton, and send any barcodes or retailer instructions.

## Delivery
State the destination, the date you need the goods and whether you prefer sea or air freight.

You can enter all of these details in the [inquiry form](/inquiry) and try colours in the [customisation studio](/studio) first.`,
  },
];
