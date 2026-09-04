CREATE TABLE `anonymous_recoveries` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `phrase_hash` text NOT NULL,
  `created_at` integer NOT NULL,
  `revoked_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_anonymous_recoveries_hash` ON `anonymous_recoveries` (`phrase_hash`);
--> statement-breakpoint
CREATE INDEX `idx_anonymous_recoveries_user` ON `anonymous_recoveries` (`user_id`);
