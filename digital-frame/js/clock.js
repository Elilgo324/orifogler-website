(function initClock() {
  const timeZone = CONFIG.timeZone || 'Asia/Jerusalem';
  const locale = CONFIG.locale || 'en-GB';
  const showSeconds = Boolean(CONFIG.showSeconds);

  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: false,
  });

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  function tick() {
    const now = new Date();
    timeEl.textContent = timeFormatter.format(now);
    dateEl.textContent = dateFormatter.format(now);
  }

  tick();
  setInterval(tick, showSeconds ? 250 : 1000);
})();
