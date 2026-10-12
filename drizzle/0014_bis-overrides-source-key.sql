PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bis_overrides` (
	`account_id` integer NOT NULL,
	`spec_slug` text NOT NULL,
	`list_type` text NOT NULL,
	`slot_key` text NOT NULL,
	`item_id` integer NOT NULL,
	`catalyst` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'method' NOT NULL,
	PRIMARY KEY(`account_id`, `spec_slug`, `source`, `list_type`, `slot_key`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_bis_overrides`("account_id", "spec_slug", "list_type", "slot_key", "item_id", "catalyst", "source") SELECT "account_id", "spec_slug", "list_type", "slot_key", "item_id", "catalyst", "source" FROM `bis_overrides`;--> statement-breakpoint
DROP TABLE `bis_overrides`;--> statement-breakpoint
ALTER TABLE `__new_bis_overrides` RENAME TO `bis_overrides`;--> statement-breakpoint
PRAGMA foreign_keys=ON;