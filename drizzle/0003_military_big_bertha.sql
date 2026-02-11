ALTER TYPE "public"."action_type" ADD VALUE 'cupid_link';--> statement-breakpoint
ALTER TYPE "public"."action_type" ADD VALUE 'white_wolf_explode';--> statement-breakpoint
ALTER TYPE "public"."phase" ADD VALUE 'night_cupid' BEFORE 'night_werewolf';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'white_wolf' BEFORE 'seer';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'cupid' BEFORE 'villager';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'madman' BEFORE 'villager';