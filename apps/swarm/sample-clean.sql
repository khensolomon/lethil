-- 10-spam-clean.sql  --  standing clean rule for <app>
-- Location: assets/queries/   (in the app repo; baked into the image)
--
-- NAMING
--   *-clean.sql      runs automatically on `db.py clean` (and export --clean).
--   NN-name-clean.sql  the NN prefix only sets run order (lexical): 10, 20, 30.
--   anything.sql     WITHOUT the -clean tag is ignored by the standing set.
--                    Keep notes, drafts, and one-offs here; run a one-off with:
--                    db.py exec <app> assets/queries/that-file.sql
--
-- DRY-RUN BY DEFAULT
--   `db.py clean <app>` and `db.py exec` wrap this in a transaction and ROLL
--   BACK unless you pass --apply. So test freely, watch the ROW_COUNT() probes,
--   then add --apply to commit. (An explicit COMMIT in your SQL, or DDL such as
--   OPTIMIZE TABLE, defeats the rollback -- keep those out of standing rules.)
--
-- These are DELETEs against the LIVE database, run as the application user,
-- scoped to DB_NAME. The clean runs `mysql -t -v`, so each statement is echoed;
-- a ROW_COUNT() probe after each DELETE reports how many rows it touched.

DELETE FROM django_session
WHERE expire_date < NOW();
SELECT ROW_COUNT() AS sessions_removed;

DELETE FROM music_comment
WHERE is_spam = 1;
SELECT ROW_COUNT() AS spam_comments_removed;

DELETE FROM accounts_user
WHERE is_active = 0
  AND last_login IS NULL
  AND date_joined < (NOW() - INTERVAL 7 DAY);
SELECT ROW_COUNT() AS abandoned_signups_removed;