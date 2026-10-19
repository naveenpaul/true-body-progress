CREATE TABLE `routine` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routine_exercise` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`position` integer NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`rep_min` integer,
	`rep_max` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routine`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_routine_exercise_routine` ON `routine_exercise` (`routine_id`,`position`);--> statement-breakpoint
ALTER TABLE `exercise` ADD `tracking_type` text DEFAULT 'weight_reps' NOT NULL;--> statement-breakpoint
ALTER TABLE `workout_session` ADD `routine_id` integer REFERENCES routine(id);--> statement-breakpoint
CREATE INDEX `idx_workout_session_routine` ON `workout_session` (`routine_id`);--> statement-breakpoint
ALTER TABLE `workout_set` ADD `duration_sec` integer;--> statement-breakpoint
ALTER TABLE `workout_set` ADD `distance_m` real;--> statement-breakpoint
ALTER TABLE `workout_set` ADD `bodyweight_kg` real;