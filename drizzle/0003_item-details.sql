CREATE TABLE `item_details` (
	`item_id` integer PRIMARY KEY NOT NULL,
	`quality` text,
	`is_tier` integer NOT NULL,
	`fetched_at` integer NOT NULL
);
