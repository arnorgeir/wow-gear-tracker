CREATE TABLE `tier_stat_marks` (
	`account_id` integer NOT NULL,
	`character_id` integer NOT NULL,
	`slot` text NOT NULL,
	`item_id` integer NOT NULL,
	`bonus_ids` text NOT NULL,
	`target_item_id` integer NOT NULL,
	`right` integer NOT NULL,
	PRIMARY KEY(`account_id`, `character_id`, `slot`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
