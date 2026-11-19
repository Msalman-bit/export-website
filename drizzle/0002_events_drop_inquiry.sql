ALTER TABLE "events" DROP CONSTRAINT "events_inquiry_id_inquiries_id_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "inquiry_id";