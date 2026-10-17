-- The default bell schedule stored afternoon periods in 12-hour form without
-- AM/PM ("12:45"-"01:30" for Period 6), so they sorted before the morning and
-- broke period ordering, overlap checks and the time picker (which shows them
-- as 1:30 AM). No school holds classes between 01:00 and 06:59, so those
-- times are afternoon times. Rows whose corrected start time is already taken
-- are left unchanged for a manual fix rather than failing the migration.

UPDATE "timetable_periods"
SET "endTime" = to_char(to_timestamp("endTime", 'HH24:MI') + interval '12 hours', 'HH24:MI')
WHERE "endTime" ~ '^0[1-6]:[0-5][0-9]$';

UPDATE "timetable_periods" p
SET "startTime" = to_char(to_timestamp(p."startTime", 'HH24:MI') + interval '12 hours', 'HH24:MI')
WHERE p."startTime" ~ '^0[1-6]:[0-5][0-9]$'
  AND NOT EXISTS (
    SELECT 1 FROM "timetable_periods" q
    WHERE q."schoolId" = p."schoolId"
      AND q."startTime" = to_char(to_timestamp(p."startTime", 'HH24:MI') + interval '12 hours', 'HH24:MI')
  );

UPDATE "timetable_slots"
SET "endTime" = to_char(to_timestamp("endTime", 'HH24:MI') + interval '12 hours', 'HH24:MI')
WHERE "endTime" ~ '^0[1-6]:[0-5][0-9]$';

UPDATE "timetable_slots" s
SET "startTime" = to_char(to_timestamp(s."startTime", 'HH24:MI') + interval '12 hours', 'HH24:MI')
WHERE s."startTime" ~ '^0[1-6]:[0-5][0-9]$'
  AND NOT EXISTS (
    SELECT 1 FROM "timetable_slots" t
    WHERE t."schoolId" = s."schoolId"
      AND t."sectionId" = s."sectionId"
      AND t."dayOfWeek" = s."dayOfWeek"
      AND t."startTime" = to_char(to_timestamp(s."startTime", 'HH24:MI') + interval '12 hours', 'HH24:MI')
  );
