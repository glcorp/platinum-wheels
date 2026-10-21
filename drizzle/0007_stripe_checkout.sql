ALTER TYPE "public"."payment_provider" ADD VALUE 'stripe';--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"object_id" text,
	"livemode" boolean NOT NULL,
	"link_id" uuid,
	"attempt_id" uuid,
	"outcome" text DEFAULT 'received' NOT NULL,
	"detail" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "provider_session_id" text;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD COLUMN "settle_checks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD CONSTRAINT "stripe_events_link_id_payment_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."payment_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_events" ADD CONSTRAINT "stripe_events_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stripe_events_received_at_idx" ON "stripe_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "stripe_events_link_idx" ON "stripe_events" USING btree ("link_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_provider_session_key" ON "payment_attempts" USING btree ("provider_session_id") WHERE "payment_attempts"."provider_session_id" is not null;