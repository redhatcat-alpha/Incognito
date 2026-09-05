CREATE TABLE `emoji_settings` (
	`emoji_id` integer PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_emoji_settings_status` ON `emoji_settings` (`status`);