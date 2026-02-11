CREATE TYPE "public"."action_type" AS ENUM('seer_check', 'werewolf_kill');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('lobby', 'playing', 'finished');--> statement-breakpoint
CREATE TYPE "public"."phase" AS ENUM('lobby', 'night_werewolf', 'night_seer', 'day_announce', 'day_discuss', 'day_vote', 'check_win', 'game_over');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('werewolf', 'seer', 'villager');--> statement-breakpoint
CREATE TYPE "public"."winner" AS ENUM('werewolf', 'villager');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"action_type" "action_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"result" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "game_status" DEFAULT 'lobby' NOT NULL,
	"current_phase" "phase" DEFAULT 'lobby' NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"winner" "winner",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"phase" "phase" NOT NULL,
	"player_id" uuid,
	"content" text NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"agent_name" text NOT NULL,
	"role" "role",
	"is_alive" boolean DEFAULT true NOT NULL,
	"personality" text NOT NULL,
	"seat_number" integer NOT NULL,
	"api_key" text
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"voter_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"phase" "phase" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_target_id_players_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_id_players_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_target_id_players_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;