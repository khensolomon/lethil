-- db_clean.sql -- pre-export clean for <app>
-- Location: /opt/bucket/storage/<app>/mysql/db_clean.sql
--
-- This runs against the LIVE database as the application user, immediately
-- before each `db.py export`, so spam and expired rows are removed from
-- production and the resulting dump is already clean. It is plain SQL piped
-- into the mysql client -- nothing here is db.py-specific.
--
-- RULES OF THUMB
--   * Every DELETE has an explicit WHERE on an indexed column. Never an
--     unqualified DELETE, and never a DELETE that could empty a whole table.
--   * Make rules idempotent: a second run on already-clean data does nothing.
--   * Test a NEW rule before trusting it -- swap DELETE for SELECT COUNT(*)
--     with the same WHERE and run it by hand to see how many rows it hits.
--   * Replace every <table>/<column> below with this app's real schema.
--   * Keep it fast. This runs on every backup; long table locks block the app.
--
-- The DML below is wrapped in one transaction. If any statement errors, the
-- mysql client aborts and the connection closes with the work uncommitted, so
-- the database rolls back rather than half-cleaning. (DDL such as OPTIMIZE
-- TABLE forces an implicit commit and cannot sit inside a transaction -- see
-- the optional section at the bottom.)

SET autocommit = 0;
START TRANSACTION;

-- 1) Expired Django sessions.
--    Safe on any Django app as-is; this table is the most common bloat source.
DELETE FROM django_session
WHERE expire_date < NOW();

-- 2) Comments explicitly flagged as spam by moderation.
--    Point this at your real comment/moderation table and flag column.
DELETE FROM music_comment
WHERE is_spam = 1;

-- 3) Unapproved comments older than 30 days from never-activated accounts.
--    Example of a join-based rule: removes drive-by spam that was never
--    approved and whose author never verified. Tune the window to taste.
DELETE c
FROM music_comment AS c
JOIN accounts_user AS u ON u.id = c.user_id
WHERE c.is_approved = 0
  AND u.is_active = 0
  AND c.created_at < (NOW() - INTERVAL 30 DAY);

-- 4) Abandoned signups: inactive, never logged in, older than 7 days.
--    Catches bot registrations before they accumulate. Widen the window if
--    legitimate users sometimes activate late.
DELETE FROM accounts_user
WHERE is_active = 0
  AND last_login IS NULL
  AND date_joined < (NOW() - INTERVAL 7 DAY);

-- 5) Expired one-time tokens (password reset, email verification, etc.).
DELETE FROM accounts_emailtoken
WHERE expires_at < NOW();

-- 6) Application/audit log rows older than 90 days that need not live in dumps.
DELETE FROM audit_log
WHERE created_at < (NOW() - INTERVAL 90 DAY);

-- 7) Draining a large backlog gently.
--    For a table with millions of spam rows, a single DELETE creates a long
--    transaction and heavy locking. Cap each run with ORDER BY + LIMIT so locks
--    stay short; because export runs on a schedule, the backlog drains over
--    several runs while the app keeps responding. (Keep this inside its own
--    small transaction in practice, or run it as its own rule.)
-- DELETE FROM music_play_log
-- WHERE created_at < (NOW() - INTERVAL 180 DAY)
-- ORDER BY id
-- LIMIT 50000;

COMMIT;
SET autocommit = 1;

-- -----------------------------------------------------------------------------
-- OPTIONAL -- RUN BY HAND, NOT ON EVERY BACKUP.
-- OPTIMIZE TABLE rebuilds the table to reclaim space after large deletes. On
-- InnoDB it copies the whole table and can lock it for minutes, so it does not
-- belong in a per-backup cron. It also forces an implicit commit, hence it sits
-- outside the transaction above. Uncomment only for a deliberate manual run.
--
-- OPTIMIZE TABLE music_comment, django_session;