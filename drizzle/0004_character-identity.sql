CREATE TABLE `class_media` (
	`class_name` text PRIMARY KEY NOT NULL,
	`class_id` integer NOT NULL,
	`icon_url` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `characters` ADD `race` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `faction` text;--> statement-breakpoint
ALTER TABLE `characters` ADD `avatar_url` text;