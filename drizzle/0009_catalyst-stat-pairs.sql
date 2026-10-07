ALTER TABLE `dungeon_loot` ADD `secondary_stats` text;--> statement-breakpoint
ALTER TABLE `item_details` ADD `secondary_stats` text;--> statement-breakpoint
ALTER TABLE `item_details` ADD `stats_fetched_at` integer;--> statement-breakpoint
ALTER TABLE `snapshot_items` ADD `secondary_stats` text;