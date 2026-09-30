PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bis_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` integer NOT NULL,
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
	FOREIGN KEY (`list_id`) REFERENCES `bis_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_bis_items`("id", "list_id", "position", "slot_label", "slots", "item_id", "min_item_level", "name", "bonus_ids", "is_tier", "is_catalyst", "source") SELECT "id", "list_id", "position", "slot_label", "slots", "item_id", NULL, "name", "bonus_ids", "is_tier", "is_catalyst", "source" FROM `bis_items`;--> statement-breakpoint
DROP TABLE `bis_items`;--> statement-breakpoint
ALTER TABLE `__new_bis_items` RENAME TO `bis_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;