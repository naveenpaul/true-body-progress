ALTER TABLE `nutrition_entry` ADD `source` text;--> statement-breakpoint
ALTER TABLE `nutrition_entry` ADD `source_ref` text;--> statement-breakpoint
ALTER TABLE `nutrition_entry` ADD `source_text` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_nutrition_entry_source_ref` ON `nutrition_entry` (`source_ref`);