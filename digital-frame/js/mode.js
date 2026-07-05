window.FrameMode = (function createFrameMode() {
  const STORAGE_KEY = 'digital-frame-user-mode';
  const timeZone = CONFIG.timeZone || 'Asia/Jerusalem';
  const nightStartHour = CONFIG.nightStartHour ?? 0;
  const dayStartHour = CONFIG.dayStartHour ?? 7;

  const toggleButton = document.getElementById('mode-toggle');
  let scheduleTimerId = null;

  function getUserMode() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'night' ? 'night' : 'day';
  }

  function setUserMode(mode) {
    localStorage.setItem(STORAGE_KEY, mode === 'night' ? 'night' : 'day');
    apply();
  }

  function getJerusalemHour(date = new Date()) {
    const hourText = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(date);
    return Number(hourText);
  }

  function isScheduledNight(date = new Date()) {
    const hour = getJerusalemHour(date);
    return hour >= nightStartHour && hour < dayStartHour;
  }

  function isNight() {
    if (getUserMode() === 'night') {
      return true;
    }
    return isScheduledNight();
  }

  function updateToggleLabel(showingNight) {
    if (!toggleButton) {
      return;
    }
    toggleButton.textContent = showingNight ? 'Day mode' : 'Night mode';
    toggleButton.title = showingNight ? 'Switch to day mode' : 'Switch to night mode';
  }

  function clearScheduleTimer() {
    if (scheduleTimerId !== null) {
      clearTimeout(scheduleTimerId);
      scheduleTimerId = null;
    }
  }

  function msUntilNextScheduleBoundary(fromMs = Date.now()) {
    const currentlyNight = isScheduledNight(new Date(fromMs));

    for (let offsetMs = 60_000; offsetMs <= 25 * 60 * 60 * 1000; offsetMs += 60_000) {
      const nextNight = isScheduledNight(new Date(fromMs + offsetMs));
      if (nextNight !== currentlyNight) {
        return offsetMs;
      }
    }

    return 60 * 60 * 1000;
  }

  function scheduleNextTransition() {
    clearScheduleTimer();

    if (getUserMode() !== 'day') {
      return;
    }

    const delayMs = msUntilNextScheduleBoundary();
    scheduleTimerId = setTimeout(() => {
      apply();
    }, delayMs);
  }

  function apply() {
    const showingNight = isNight();
    document.body.classList.toggle('night-mode', showingNight);
    updateToggleLabel(showingNight);

    if (showingNight) {
      Slideshow.pause();
    } else {
      Slideshow.resume();
    }

    scheduleNextTransition();
  }

  toggleButton.addEventListener('click', (event) => {
    event.stopPropagation();
    if (isNight()) {
      setUserMode('day');
      return;
    }
    setUserMode('night');
  });

  apply();

  return {
    apply,
    isNight,
    setUserMode,
    getUserMode,
    isScheduledNight,
    getJerusalemHour,
  };
})();
