CREATE TABLE `babies` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`born_at` integer NOT NULL,
	`birth_weight_g` integer,
	`birth_length_mm` integer,
	`head_circ_mm` integer,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`baby_id` text NOT NULL,
	`type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`ended_at` integer,
	`payload` text DEFAULT '{}' NOT NULL,
	`group_id` text,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`client_created_at` integer NOT NULL,
	`server_updated_at` integer,
	`seq` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `events_time` ON `events` (`baby_id`,`occurred_at`) WHERE "events"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `memberships` (
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`relation` text,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`household_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`op` text NOT NULL,
	`body` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL
);
