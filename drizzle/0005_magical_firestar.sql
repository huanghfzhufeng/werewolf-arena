CREATE TYPE "public"."play_mode" AS ENUM('hosted', 'autonomous');--> statement-breakpoint
ALTER TYPE "public"."agent_status" ADD VALUE 'dormant';--> statement-breakpoint
CREATE TABLE "agent_owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"api_key" text NOT NULL,
	"max_agents" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_owners_email_unique" UNIQUE("email"),
	CONSTRAINT "agent_owners_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "api_key" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "bio" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "elo" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "active_until" timestamp;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "play_mode" "play_mode" DEFAULT 'hosted' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_agent_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."agent_owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_api_key_unique" UNIQUE("api_key");