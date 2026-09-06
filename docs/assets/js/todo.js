/* ===========================================================================
 * Todo board — layout toggle (columns / list).
 *
 * Both layouts come from the same markup; only CSS differs. This script does
 * nothing but flip a data attribute and remember the choice, so the board is
 * fully usable with JavaScript off — it just stays on the server-rendered
 * default (columns).
 * ======================================================================== */
(function () {
  var board = document.querySelector('[data-board]');
  if (!board) return;

  var buttons = board.querySelectorAll('[data-board-set]');
  var KEY = 'todo:view';

  function apply(view, persist) {
    board.setAttribute('data-board-view', view);
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-board-set') === view;
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (persist) {
      // Storage can throw in private modes; the toggle must still work.
      try { localStorage.setItem(KEY, view); } catch (e) {}
    }
  }

  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === 'kanban' || saved === 'list') apply(saved, false);

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function () {
      apply(this.getAttribute('data-board-set'), true);
    });
  }
})();
