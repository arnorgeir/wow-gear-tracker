CREATE TABLE `snapshot_currencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`kind` text NOT NULL,
	`currency_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `gear_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `snapshot_currencies_snapshot` ON `snapshot_currencies` (`snapshot_id`);