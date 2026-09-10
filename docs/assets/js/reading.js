/* ===========================================================================
 * reading.js — small conveniences for reading a long page.
 *
 *   · a link on every heading, for pointing someone at one section
 *   · a progress bar showing position through the article
 *
 * Both are derived from what is already on the page: no configuration, no
 * front matter, nothing to keep in step with the content.
 * ======================================================================== */
(function () {
  "use strict";

  var article = document.querySelector(".docs__content.prose");
  if (!article) return;

  /* --- heading links ----------------------------------------------------- */
  // Kramdown already emits ids, so the anchors exist; they were simply not
  // reachable without reading the markup.
  var heads = article.querySelectorAll("h2[id], h3[id]");
  heads.forEach(function (h) {
    var a = document.createElement("a");
    a.className = "headlink";
    a.href = "#" + h.id;
    a.setAttribute("aria-label", "Link to this section");
    a.title = "Copy link to this section";
    a.textContent = "#";
    a.addEventListener("click", function (e) {
      if (!navigator.clipboard) return;              // let the anchor jump
      e.preventDefault();
      var url = location.origin + location.pathname + "#" + h.id;
      navigator.clipboard.writeText(url).then(function () {
        history.replaceState(null, "", "#" + h.id);
        a.classList.add("is-copied");
        setTimeout(function () { a.classList.remove("is-copied"); }, 1200);
      }, function () { location.hash = h.id; });
    });
    h.appendChild(a);
  });

  /* --- progress ---------------------------------------------------------- */
  if (!heads.length && article.offsetHeight < window.innerHeight * 1.5) return;

  var bar = document.createElement("div");
  bar.className = "readbar";
  bar.innerHTML = '<span class="readbar__fill"></span>';
  document.body.appendChild(bar);
  var fill = bar.firstChild;

  var ticking = false;
  function update() {
    var top = article.offsetTop;
    var height = article.offsetHeight - window.innerHeight;
    var seen = window.scrollY - top;
    var pct = height > 0 ? Math.min(1, Math.max(0, seen / height)) : 0;
    fill.style.transform = "scaleX(" + pct + ")";
    ticking = false;
  }
  // rAF-throttled: scroll fires far more often than the screen repaints.
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
})();
