CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bis_overrides` (
	`account_id` integer NOT NULL,
	`spec_slug` text NOT NULL,
	`list_type` text NOT NULL,
	`slot_key` text NOT NULL,
	`item_id` integer NOT NULL,
	`catalyst` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`account_id`, `spec_slug`, `list_type`, `slot_key`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `item_catalog` (
	`item_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`inventory_type` text,
	`armor_type` text,
	`quality` text,
	`is_tier` integer NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spec_settings` (
	`account_id` integer NOT NULL,
	`spec_slug` text NOT NULL,
	`list_type` text DEFAULT 'mythicPlus' NOT NULL,
	`stats_matter` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`account_id`, `spec_slug`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `specs` (
	`method_slug` text PRIMARY KEY NOT NULL,
	`class_id` integer NOT NULL,
	`class_name` text NOT NULL,
	`spec_name` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `dungeon_loot` ADD `quality` text;--> statement-breakpoint
ALTER TABLE `dungeon_loot` ADD `is_tier` integer DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO `accounts` (`id`, `name`) VALUES (1, 'Local');
