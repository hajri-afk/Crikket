ALTER TABLE "bug_report" ADD COLUMN "test_scenario" text;--> statement-breakpoint
ALTER TABLE "bug_report" ADD COLUMN "test_case_type" text;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD COLUMN "test_scenario" text;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD COLUMN "test_case_type" text;