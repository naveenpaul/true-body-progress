CREATE TABLE `estimated_food` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `nutrition_entry` ADD `estimate_version` integer;