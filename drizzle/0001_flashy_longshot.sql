ALTER TYPE "public"."action_type" ADD VALUE 'witch_save';--> statement-breakpoint
ALTER TYPE "public"."action_type" ADD VALUE 'witch_poison';--> statement-breakpoint
ALTER TYPE "public"."action_type" ADD VALUE 'guard_protect';--> statement-breakpoint
ALTER TYPE "public"."action_type" ADD VALUE 'hunter_shoot';--> statement-breakpoint
ALTER TYPE "public"."phase" ADD VALUE 'night_witch' BEFORE 'day_announce';--> statement-breakpoint
ALTER TYPE "public"."phase" ADD VALUE 'night_guard' BEFORE 'day_announce';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'wolf_king' BEFORE 'seer';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'witch' BEFORE 'villager';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'guard' BEFORE 'villager';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'hunter' BEFORE 'villager';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'elder' BEFORE 'villager';--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "mode_id" text DEFAULT 'classic-6p' NOT NULL;