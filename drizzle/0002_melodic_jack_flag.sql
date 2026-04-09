CREATE TABLE `food` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_lower` text NOT NULL,
	`cuisine` text NOT NULL,
	`category` text NOT NULL,
	`default_serving_qty` real NOT NULL,
	`default_serving_unit` text NOT NULL,
	`default_serving_grams` real,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real,
	`source` text NOT NULL,
	`is_favorite` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_food_name_lower` ON `food` (`name_lower`);--> statement-breakpoint
CREATE INDEX `idx_food_cuisine` ON `food` (`cuisine`);--> statement-breakpoint
CREATE INDEX `idx_food_favorite` ON `food` (`is_favorite`);--> statement-breakpoint
ALTER TABLE `nutrition_entry` ADD `food_id` text REFERENCES food(id);--> statement-breakpoint
ALTER TABLE `nutrition_entry` ADD `servings` real;--> statement-breakpoint
CREATE INDEX `idx_nutrition_entry_food` ON `nutrition_entry` (`food_id`);