-- Per-person permissions for teachers and accountants. NULL means the role's
-- defaults, so existing logins keep what they could do before.
ALTER TABLE "users" ADD COLUMN "permissions" JSONB;
