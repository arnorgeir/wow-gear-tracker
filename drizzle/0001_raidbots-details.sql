CREATE TABLE `bonus_qualities` (
	`bonus_id` integer PRIMARY KEY NOT NULL,
	`quality` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `upgrade_tracks` ADD `group_id` integer;--> statement-breakpoint
ALTER TABLE `upgrade_tracks` ADD `currency_name` text;