CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rp_id" text NOT NULL,
	"device_type" text DEFAULT '' NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"aaguid" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webauthn_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"user_id" uuid,
	"challenge" text NOT NULL,
	"rp_id" text NOT NULL,
	"origin" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_challenges" ADD CONSTRAINT "webauthn_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passkeys_user" ON "passkeys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "webauthn_challenges_expires" ON "webauthn_challenges" USING btree ("expires_at");