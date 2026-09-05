CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_admin_audit_created` ON `admin_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_audit_admin` ON `admin_audit_logs` (`admin_user_id`);
