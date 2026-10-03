CREATE TABLE `dungeon_loot` (
	`challenge_mode_id` integer NOT NULL,
	`encounter_id` integer NOT NULL,
	`encounter_name` text NOT NULL,
	`item_id` integer NOT NULL,
	`item_name` text NOT NULL,
	`inventory_type` text,
	`armor_type` text,
	PRIMARY KEY(`challenge_mode_id`, `encounter_id`, `item_id`),
	FOREIGN KEY (`challenge_mode_id`) REFERENCES `season_dungeons`(`challenge_mode_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `season_dungeons` (
	`challenge_mode_id` integer PRIMARY KEY NOT NULL,
	`season_slug` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`journal_instance_id` integer NOT NULL,
	`map_id` integer NOT NULL
);
