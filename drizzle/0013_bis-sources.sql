CREATE TABLE `manual_bis_items` (
	`account_id` integer NOT NULL,
	`spec_slug` text NOT NULL,
	`list_type` text NOT NULL,
	`position` integer NOT NULL,
	`slot_label` text NOT NULL,
	`slots` text NOT NULL,
	`item_id` integer,
	`min_item_level` integer,
	`name` text NOT NULL,
	`bonus_ids` text NOT NULL,
	`is_tier` integer NOT NULL,
	`is_catalyst` integer NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`account_id`, `spec_slug`, `list_type`, `position`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `manual_bis_lists` (
	`account_id` integer NOT NULL,
	`spec_slug` text NOT NULL,
	`copied_from` text NOT NULL,
	`copied_at` integer NOT NULL,
	PRIMARY KEY(`account_id`, `spec_slug`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP INDEX `bis_lists_spec_type`;--> statement-breakpoint
ALTER TABLE `bis_lists` ADD `source` text DEFAULT 'method' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `bis_lists_source_spec_type` ON `bis_lists` (`source`,`spec_slug`,`list_type`);--> statement-breakpoint
ALTER TABLE `bis_overrides` ADD `source` text DEFAULT 'method' NOT NULL;--> statement-breakpoint
ALTER TABLE `spec_settings` ADD `source` text DEFAULT 'method' NOT NULL;