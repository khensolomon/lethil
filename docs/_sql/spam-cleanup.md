---
title: "Clearing bot spam"
description: "Deleting bot-inserted keyword rows by Unicode script, in batches."
group: "Operations"
category: "SQL"
nav_order: 4
tags: [mysql, regex, spam, maintenance]
---

The `log_keyword` table on MyOrdbok collected roughly 1.4 million bot rows in
scripts the site does not serve. Matching by Unicode script is far more
reliable than matching individual words.

Always run the `SELECT` first and check the row count before the matching
`DELETE`.

## Find

```sql
-- Han, Bengali, Japanese, Devanagari
SELECT * FROM log_keyword
WHERE word REGEXP '\\p{Han}|\\p{Bengali}|\\p{Hiragana}|\\p{Katakana}|\\p{Devanagari}'
LIMIT 50;

-- Anything outside printable ASCII, while keeping legitimate Myanmar text
SELECT word, HEX(word) FROM log_keyword
WHERE word NOT REGEXP '^[ -~]*$'
  AND word NOT REGEXP '\\p{Myanmar}'
LIMIT 20;

-- Injected URLs
SELECT * FROM log_keyword
WHERE word LIKE '%.com%' OR word LIKE '%.win%'
   OR word LIKE '%.net%' OR word LIKE '%.org%';
```

## Delete

Batch it. A single unbounded `DELETE` over a million rows will lock the table
and can time out — repeat until affected rows reaches zero.

```sql
DELETE FROM log_keyword
WHERE word REGEXP '\\p{Han}|\\p{Bengali}|\\p{Hiragana}|\\p{Katakana}|\\p{Devanagari}'
LIMIT 50000;

DELETE FROM log_keyword
WHERE word NOT REGEXP '^[ -~\\p{Myanmar}]+$'
LIMIT 100000;
```
