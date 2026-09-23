// Release gate. Anything marked data-release="YYYY-MM-DD" stays hidden (CSS) and is
// removed from the page before that date; on/after it, it is shown. Anything marked
// data-until="YYYY-MM-DD" is shown before that date and removed on/after it.
// Preview an unreleased episode with ?preview-release in the URL.
// To release early or postpone, change the date on the elements (see README).
(function () {
  var t = new Date();
  var today = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  var preview = /[?&]preview-release\b/.test(location.search);
  [].forEach.call(document.querySelectorAll('[data-release]'), function (el) {
    if (preview || today >= el.getAttribute('data-release')) el.classList.add('is-released');
    else el.parentNode.removeChild(el);
  });
  [].forEach.call(document.querySelectorAll('[data-until]'), function (el) {
    if (preview || today >= el.getAttribute('data-until')) el.parentNode.removeChild(el);
  });
})();
