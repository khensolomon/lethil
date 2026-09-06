#!/bin/bash
# Run from your site root (the folder containing _config.yml).
# Reports whether the Todo work is actually installed.
echo "site root: $(pwd)"
[ -f _config.yml ] || { echo "!! No _config.yml here - wrong directory."; exit 1; }
echo
echo "--- files that must exist ---"
for f in _todo/index.md _todo/bible.md _todo/obsidian-import.md _todo/auto-index.md \
         _layouts/todo.html _includes/nav-docs.html _includes/doc-title.html \
         _includes/task-count.html _includes/todo-status.html \
         _sass/_todo.scss assets/js/todo.js; do
  [ -f "$f" ] && echo "  ok      $f" || echo "  MISSING $f"
done
echo
echo "--- files that must be GONE ---"
for f in Changelog.md _note/bible.md _includes/all-docs.html; do
  [ -f "$f" ] && echo "  STILL PRESENT $f" || echo "  ok (removed)  $f"
done
echo
echo "--- required edits ---"
grep -q 'todo:.*output: true' _config.yml \
  && echo "  ok      _config.yml registers the todo collection" \
  || echo "  MISSING _config.yml has no todo collection"
grep -q 'layout: "todo"' _config.yml \
  && echo "  ok      _config.yml maps todo -> layout todo" \
  || echo "  MISSING _config.yml todo layout mapping"
grep -q 'key: todo' _data/sections.yml \
  && echo "  ok      _data/sections.yml lists the Todo section" \
  || echo "  MISSING _data/sections.yml has no Todo entry"
grep -q '@import "todo"' assets/css/style.scss \
  && echo "  ok      style.scss imports the todo partial" \
  || echo "  MISSING style.scss does not import _todo.scss"
grep -q 'Open {{ meta.label }}' _includes/sidebar_section.html \
  && echo "  ok      sidebar links to every section index" \
  || echo "  MISSING sidebar_section.html not updated (Todo unreachable)"
echo
echo "If anything above says MISSING, that file did not get copied."
echo "If all ok: stop jekyll and start it again - 'serve' never reloads _config.yml."
