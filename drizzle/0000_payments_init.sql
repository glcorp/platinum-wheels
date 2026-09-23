CREATE TYPE "public"."payment_attempt_status" AS ENUM('pending', 'approved', 'declined', 'failed', 'expired', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."payment_environment" AS ENUM('demo', 'production');--> statement-breakpoint
CREATE TYPE "public"."payment_event_actor" AS ENUM('staff', 'customer', 'system', 'provider');--> statement-breakpoint
CREATE TYPE "public"."payment_link_status" AS ENUM('active', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('converge');--> statement-breakpoint
CREATE SEQUENCE "public"."payment_link_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 10001 CACHE 1;--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"environment" "payment_environment" NOT NULL,
	"provider_invoice_number" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" char(3) DEFAULT 'CAD' NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'pending' NOT NULL,
	"provider_txn_id" text,
	"approval_code" text,
	"result_message" text,
	"card_brand" text,
	"card_last4" char(4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_attempt_no_positive" CHECK ("payment_attempts"."attempt_no" >= 1),
	CONSTRAINT "payment_attempts_amount_positive" CHECK ("payment_attempts"."amount_cents" > 0),
	CONSTRAINT "payment_attempts_currency_cad" CHECK ("payment_attempts"."currency" = 'CAD'),
	CONSTRAINT "payment_attempts_last4_digits" CHECK ("payment_attempts"."card_last4" is null or "payment_attempts"."card_last4" ~ '^[0-9]{4}$'),
	CONSTRAINT "payment_attempts_settled_has_txn" CHECK ("payment_attempts"."status" not in ('approved', 'duplicate') or ("payment_attempts"."provider_txn_id" is not null and "payment_attempts"."verified_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"link_id" uuid NOT NULL,
	"attempt_id" uuid,
	"type" text NOT NULL,
	"actor" "payment_event_actor" NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_type_format" CHECK ("payment_events"."type" ~ '^[a-z_]+(\.[a-z_]+)+$')
);
--> statement-breakpoint
CREATE TABLE "payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text DEFAULT ('PW-' || nextval('payment_link_reference_seq')) NOT NULL,
	"public_token" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" char(3) DEFAULT 'CAD' NOT NULL,
	"description" text NOT NULL,
	"status" "payment_link_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	CONSTRAINT "payment_links_amount_positive" CHECK ("payment_links"."amount_cents" > 0),
	CONSTRAINT "payment_links_currency_cad" CHECK ("payment_links"."currency" = 'CAD'),
	CONSTRAINT "payment_links_description_length" CHECK (char_length("payment_links"."description") between 1 and 200),
	CONSTRAINT "payment_links_token_length" CHECK (char_length("payment_links"."public_token") >= 22),
	CONSTRAINT "payment_links_expires_after_created" CHECK ("payment_links"."expires_at" > "payment_links"."created_at"),
	CONSTRAINT "payment_links_paid_state" CHECK (("payment_links"."status" = 'paid') = ("payment_links"."paid_at" is not null)),
	CONSTRAINT "payment_links_cancelled_state" CHECK (("payment_links"."status" = 'cancelled') = ("payment_links"."cancelled_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_link_id_payment_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."payment_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_link_id_payment_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."payment_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_link_attempt_no_key" ON "payment_attempts" USING btree ("link_id","attempt_no");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_invoice_number_key" ON "payment_attempts" USING btree ("provider_invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_provider_txn_key" ON "payment_attempts" USING btree ("provider","provider_txn_id") WHERE "payment_attempts"."provider_txn_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_one_approved_per_link" ON "payment_attempts" USING btree ("link_id") WHERE "payment_attempts"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "payment_attempts_pending_idx" ON "payment_attempts" USING btree ("created_at") WHERE "payment_attempts"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "payment_events_link_created_at_idx" ON "payment_events" USING btree ("link_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_links_reference_key" ON "payment_links" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_links_public_token_key" ON "payment_links" USING btree ("public_token");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_links_idempotency_key_key" ON "payment_links" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_links_status_created_at_idx" ON "payment_links" USING btree ("status","created_at");