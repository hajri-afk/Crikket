CREATE TABLE "room" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text DEFAULT 'slate' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bug_report" ADD COLUMN "room_id" text;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD COLUMN "room_id" text;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_organizationId_idx" ON "room" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "room_status_idx" ON "room" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "room_organizationId_slug_idx" ON "room" USING btree ("organization_id","slug");--> statement-breakpoint
ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_report_upload_session" ADD CONSTRAINT "bug_report_upload_session_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bug_report_roomId_idx" ON "bug_report" USING btree ("room_id");