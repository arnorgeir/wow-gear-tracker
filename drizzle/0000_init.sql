CREATE TABLE `bis_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` integer NOT NULL,
	`position` integer NOT NULL,
	`slot_label` text NOT NULL,
	`slots` text NOT NULL,
	`item_id` integer NOT NULL,
	`name` text NOT NULL,
	`bonus_ids` text NOT NULL,
	`is_tier` integer NOT NULL,
	`is_catalyst` integer NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `bis_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bis_lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spec_slug` text NOT NULL,
	`list_type` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bis_lists_spec_type` ON `bis_lists` (`spec_slug`,`list_type`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`region` text NOT NULL,
	`realm_id` integer NOT NULL,
	`realm_slug` text NOT NULL,
	`realm_name` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`class_name` text NOT NULL,
	`spec_name` text NOT NULL,
	`spec_override` text,
	`priority_list` text DEFAULT 'mythicPlus' NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`last_synced_at` integer,
	`last_sync_error` text,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_identity` ON `characters` (`region`,`realm_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `gear_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` integer NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`content_hash` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gear_snapshots_character` ON `gear_snapshots` (`character_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `items` (
	`item_id` integer PRIMARY KEY NOT NULL,
	`icon_url` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshot_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`location` text NOT NULL,
	`slot` text NOT NULL,
	`item_id` integer NOT NULL,
	`name` text NOT NULL,
	`item_level` integer,
	`quality` text NOT NULL,
	`bonus_ids` text NOT NULL,
	`is_tier` integer NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `gear_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `snapshot_items_snapshot` ON `snapshot_items` (`snapshot_id`);--> statement-breakpoint
CREATE TABLE `upgrade_tracks` (
	`bonus_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`step` integer NOT NULL,
	`max` integer NOT NULL,
	`currency_id` integer,
	`cost_per_step` integer
);
