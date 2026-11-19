import {
  pgTable, text, uuid, timestamp, boolean, integer, jsonb, numeric, primaryKey, uniqueIndex, index, serial,
} from 'drizzle-orm/pg-core';

/* Monolith Sports database schema (PostgreSQL; PGlite locally).
   Text columns with TypeScript unions stand in for enums, so a new status needs no migration. */

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const INQUIRY_STATUSES = [
  'new', 'under_review', 'quotation_prepared', 'quotation_sent', 'sample_requested', 'sample_approved',
  'order_confirmed', 'in_production', 'quality_inspection', 'shipped', 'completed',
] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const ORDER_STATUSES = ['order_confirmed', 'in_production', 'quality_inspection', 'shipped', 'completed'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STAFF_ROLES = ['admin', 'sales', 'content', 'production'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type InquiryType = 'quote' | 'sample' | 'distributor' | 'partnership' | 'contact';
export type Currency = 'EUR' | 'GBP' | 'USD';
export type Spec = { label: string; value: string };
export type ProductImage = { url: string; alt: string; source?: string };

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  country: text('country').notNull().default(''),
  website: text('website').notNull().default(''),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  preferredCurrency: text('preferred_currency').$type<Currency>().notNull().default('EUR'),
  notes: text('notes').notNull().default(''),
  createdAt: created(),
  updatedAt: updated(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull().default(''),
  kind: text('kind').$type<'customer' | 'staff'>().notNull(),
  role: text('role').notNull().default('member'),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  mfaSecret: text('mfa_secret'),
  mfaEnabledAt: timestamp('mfa_enabled_at', { withTimezone: true }),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex('users_email_kind').on(t.email, t.kind)]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // SHA-256 of the cookie token; the token itself is never stored
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'customer' | 'staff'>().notNull(),
  mfaVerified: boolean('mfa_verified').notNull().default(false),
  userAgent: text('user_agent').notNull().default(''),
  createdAt: created(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [index('sessions_user').on(t.userId)]);

export const tokens = pgTable('tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose').$type<'verify' | 'reset' | 'newsletter'>().notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex('tokens_hash').on(t.tokenHash)]);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  parentId: uuid('parent_id'),
  name: text('name').notNull(),
  summary: text('summary').notNull().default(''),
  body: text('body').notNull().default(''),
  image: jsonb('image').$type<ProductImage | null>(),
  sortOrder: integer('sort_order').notNull().default(0),
  published: boolean('published').notNull().default(false),
  seoTitle: text('seo_title').notNull().default(''),
  seoDescription: text('seo_description').notNull().default(''),
  updatedAt: updated(),
}, (t) => [uniqueIndex('categories_slug').on(t.slug)]);

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  sku: text('sku').notNull(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  summary: text('summary').notNull().default(''),
  description: text('description').notNull().default(''),
  construction: text('construction').notNull().default(''),
  materials: text('materials').notNull().default(''),
  sizes: jsonb('sizes').$type<string[]>().notNull().default([]),
  weight: text('weight').notNull().default(''),
  colours: jsonb('colours').$type<string[]>().notNull().default([]),
  brandingOptions: jsonb('branding_options').$type<string[]>().notNull().default([]),
  packagingOptions: jsonb('packaging_options').$type<string[]>().notNull().default([]),
  moq: text('moq').notNull().default(''),
  leadTime: text('lead_time').notNull().default(''),
  testingStandards: jsonb('testing_standards').$type<string[]>().notNull().default([]),
  specs: jsonb('specs').$type<Spec[]>().notNull().default([]),
  images: jsonb('images').$type<ProductImage[]>().notNull().default([]),
  spinFrames: jsonb('spin_frames').$type<string[]>().notNull().default([]),
  studioModel: text('studio_model').$type<'football' | 'glove' | 'jersey' | null>(),
  relatedIds: jsonb('related_ids').$type<string[]>().notNull().default([]),
  status: text('status').$type<'draft' | 'published'>().notNull().default('draft'),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  seoTitle: text('seo_title').notNull().default(''),
  seoDescription: text('seo_description').notNull().default(''),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex('products_slug').on(t.slug), uniqueIndex('products_sku').on(t.sku), index('products_cat').on(t.categoryId)]);

export const inquiries = pgTable('inquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: text('reference').notNull(),
  type: text('type').$type<InquiryType>().notNull().default('quote'),
  status: text('status').$type<InquiryStatus>().notNull().default('new'),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull().default(''),
  country: text('country').notNull().default(''),
  currency: text('currency').$type<Currency>().notNull().default('EUR'),
  branding: text('branding').notNull().default(''),
  packaging: text('packaging').notNull().default(''),
  targetDate: text('target_date').notNull().default(''),
  shippingMethod: text('shipping_method').notNull().default(''),
  message: text('message').notNull().default(''),
  locale: text('locale').notNull().default('en'),
  sourcePage: text('source_page').notNull().default(''),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex('inquiries_ref').on(t.reference), index('inquiries_status').on(t.status), index('inquiries_company').on(t.companyId)]);

export const inquiryItems = pgTable('inquiry_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  inquiryId: uuid('inquiry_id').notNull().references(() => inquiries.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  sku: text('sku').notNull().default(''),
  quantity: integer('quantity').notNull(),
  notes: text('notes').notNull().default(''),
  customisation: jsonb('customisation').$type<Record<string, unknown> | null>(),
}, (t) => [index('inquiry_items_inq').on(t.inquiryId)]);

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerType: text('owner_type').$type<'inquiry' | 'document' | 'message' | 'customisation' | 'certificate' | 'media'>().notNull(),
  ownerId: uuid('owner_id'),
  filename: text('filename').notNull(),
  storedName: text('stored_name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  uploadedBy: uuid('uploaded_by'),
  createdAt: created(),
}, (t) => [index('attachments_owner').on(t.ownerType, t.ownerId)]);

export const inquiryEvents = pgTable('inquiry_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  inquiryId: uuid('inquiry_id').notNull().references(() => inquiries.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'status' | 'note' | 'email' | 'created'>().notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  body: text('body').notNull().default(''),
  visibleToCustomer: boolean('visible_to_customer').notNull().default(false),
  authorId: uuid('author_id'),
  createdAt: created(),
}, (t) => [index('inquiry_events_inq').on(t.inquiryId)]);

export type QuoteLine = { description: string; sku: string; quantity: number; unitPrice: string };

export const quotations = pgTable('quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  inquiryId: uuid('inquiry_id').notNull().references(() => inquiries.id, { onDelete: 'cascade' }),
  currency: text('currency').$type<Currency>().notNull(),
  lines: jsonb('lines').$type<QuoteLine[]>().notNull().default([]),
  shippingCost: numeric('shipping_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 14, scale: 2 }).notNull().default('0'),
  paymentTerms: text('payment_terms').notNull().default(''),
  incoterm: text('incoterm').notNull().default(''),
  leadTime: text('lead_time').notNull().default(''),
  validUntil: text('valid_until').notNull().default(''),
  notes: text('notes').notNull().default(''),
  status: text('status').$type<'draft' | 'sent' | 'accepted' | 'declined'>().notNull().default('draft'),
  createdBy: uuid('created_by'),
  createdAt: created(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (t) => [uniqueIndex('quotations_number').on(t.number)]);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  inquiryId: uuid('inquiry_id').references(() => inquiries.id, { onDelete: 'set null' }),
  quotationId: uuid('quotation_id').references(() => quotations.id, { onDelete: 'set null' }),
  status: text('status').$type<OrderStatus>().notNull().default('order_confirmed'),
  currency: text('currency').$type<Currency>().notNull().default('EUR'),
  total: numeric('total', { precision: 14, scale: 2 }).notNull().default('0'),
  notes: text('notes').notNull().default(''),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex('orders_number').on(t.number), index('orders_company').on(t.companyId)]);

export const shipments = pgTable('shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  method: text('method').notNull().default(''),
  carrier: text('carrier').notNull().default(''),
  trackingNumber: text('tracking_number').notNull().default(''),
  trackingUrl: text('tracking_url').notNull().default(''),
  shippedAt: text('shipped_at').notNull().default(''),
  eta: text('eta').notNull().default(''),
  status: text('status').notNull().default('booked'),
  createdAt: created(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').$type<Currency>().notNull(),
  issuedAt: text('issued_at').notNull(),
  dueAt: text('due_at').notNull().default(''),
  status: text('status').$type<'issued' | 'paid' | 'void'>().notNull().default('issued'),
  notes: text('notes').notNull().default(''),
  createdAt: created(),
}, (t) => [uniqueIndex('invoices_number').on(t.number)]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  kind: text('kind').$type<'technical' | 'catalogue' | 'certificate' | 'other'>().notNull().default('technical'),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  visibility: text('visibility').$type<'public' | 'customers' | 'company'>().notNull().default('company'),
  attachmentId: uuid('attachment_id').notNull(),
  createdAt: created(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  inquiryId: uuid('inquiry_id').references(() => inquiries.id, { onDelete: 'set null' }),
  authorId: uuid('author_id'),
  fromStaff: boolean('from_staff').notNull().default(false),
  body: text('body').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [index('messages_company').on(t.companyId)]);

export const savedProducts = pgTable('saved_products', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt: created(),
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })]);

export const customisations = pgTable('customisations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().notNull(),
  createdAt: created(),
});

export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  section: text('section').notNull().default('company'),
  title: text('title').notNull(),
  summary: text('summary').notNull().default(''),
  body: text('body').notNull().default(''),
  seoTitle: text('seo_title').notNull().default(''),
  seoDescription: text('seo_description').notNull().default(''),
  status: text('status').$type<'draft' | 'published'>().notNull().default('draft'),
  needsReview: boolean('needs_review').notNull().default(false),
  reviewNote: text('review_note').notNull().default(''),
  updatedAt: updated(),
}, (t) => [uniqueIndex('pages_slug').on(t.slug)]);

export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull().default(''),
  body: text('body').notNull().default(''),
  author: text('author').notNull().default(''),
  status: text('status').$type<'draft' | 'published'>().notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  seoTitle: text('seo_title').notNull().default(''),
  seoDescription: text('seo_description').notNull().default(''),
  updatedAt: updated(),
}, (t) => [uniqueIndex('articles_slug').on(t.slug)]);

export const testimonials = pgTable('testimonials', {
  id: uuid('id').primaryKey().defaultRandom(),
  quote: text('quote').notNull(),
  personName: text('person_name').notNull(),
  role: text('role').notNull().default(''),
  company: text('company').notNull().default(''),
  consentConfirmed: boolean('consent_confirmed').notNull().default(false),
  verified: boolean('verified').notNull().default(false),
  published: boolean('published').notNull().default(false),
  createdAt: created(),
});

export const certificates = pgTable('certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  issuer: text('issuer').notNull().default(''),
  number: text('number').notNull().default(''),
  scope: text('scope').notNull().default(''),
  validUntil: text('valid_until').notNull().default(''),
  attachmentId: uuid('attachment_id'),
  verified: boolean('verified').notNull().default(false),
  published: boolean('published').notNull().default(false),
  createdAt: created(),
});

export const facts = pgTable('facts', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  value: text('value').notNull().default(''),
  verified: boolean('verified').notNull().default(false),
  note: text('note').notNull().default(''),
  updatedAt: updated(),
});

export const markets = pgTable('markets', {
  code: text('code').primaryKey(), // ISO 3166-1 numeric (map) as text
  iso2: text('iso2').notNull(),
  name: text('name').notNull(),
  region: text('region').notNull(),
  status: text('status').$type<'established' | 'target'>().notNull().default('target'),
  note: text('note').notNull().default(''),
});

export const translations = pgTable('translations', {
  id: serial('id').primaryKey(),
  locale: text('locale').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  status: text('status').$type<'draft' | 'reviewed'>().notNull().default('draft'),
  updatedAt: updated(),
}, (t) => [uniqueIndex('translations_locale_key').on(t.locale, t.key)]);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: updated(),
});

export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  locale: text('locale').notNull().default('en'),
  unsubscribeToken: text('unsubscribe_token').notNull(),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex('subscribers_email').on(t.email)]);

export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  status: text('status').$type<'sent' | 'logged' | 'failed'>().notNull(),
  providerId: text('provider_id').notNull().default(''),
  error: text('error').notNull().default(''),
  createdAt: created(),
});

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  actorId: uuid('actor_id'),
  actorEmail: text('actor_email').notNull().default(''),
  action: text('action').notNull(),
  entity: text('entity').notNull().default(''),
  entityId: text('entity_id').notNull().default(''),
  detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: created(),
}, (t) => [index('audit_created').on(t.createdAt)]);

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull().default(''),
  productId: uuid('product_id'),
  country: text('country').notNull().default(''),
  locale: text('locale').notNull().default(''),
  createdAt: created(),
}, (t) => [index('events_name_created').on(t.name, t.createdAt)]);
