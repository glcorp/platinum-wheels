-- payment_events is the audit trail for money. It is append-only by rule, and
-- this trigger makes that rule the database's, not the application's: any
-- UPDATE or DELETE raises, whoever issues it. TRUNCATE is blocked the same way.
-- A correction is a new event that supersedes an old one, never an edit.
CREATE FUNCTION payment_events_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'payment_events is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payment_events_no_update_delete
  BEFORE UPDATE OR DELETE ON "payment_events"
  FOR EACH ROW EXECUTE FUNCTION payment_events_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER payment_events_no_truncate
  BEFORE TRUNCATE ON "payment_events"
  FOR EACH STATEMENT EXECUTE FUNCTION payment_events_reject_mutation();
