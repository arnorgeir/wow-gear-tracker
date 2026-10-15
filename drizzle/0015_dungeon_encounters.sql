CREATE TABLE `dungeon_encounters` (
	`encounter_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sections` text NOT NULL
);
