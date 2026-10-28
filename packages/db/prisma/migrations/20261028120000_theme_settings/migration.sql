-- The school's theme color and each person's light/dark choice. NULL means
-- Kora's purple and no saved choice, so nothing changes for existing data.
ALTER TABLE "schools" ADD COLUMN "themeColor" TEXT;
ALTER TABLE "users" ADD COLUMN "colorMode" TEXT;
