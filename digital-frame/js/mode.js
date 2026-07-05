window.FrameMode = (function createFrameMode() {
  const timeZone = CONFIG.timeZone || 'Asia/Jerusalem';
  const nightStartHour = CONFIG.nightStartHour ?? 0;
  const dayStartHour = CONFIG.dayStartHour ?? 7;

  const toggleButton = document.getElementById('mode-toggle');
  let scheduleTimerId = null;
  let manualOverride = null;

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

  function hasManualOverride() {
    return manualOverride !== null;
  }

  function isNight() {
    if (manualOverride === 'night') {
      return true;
    }
    if (manualOverride === 'day') {
      return false;
    }
    return isScheduledNight();
  }

  function getUserMode() {
    return isNight() ? 'night' : 'day';
  }

  function setUserMode(mode) {
    manualOverride = mode === 'night' ? 'night' : 'day';
    apply();
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

    if (manualOverride !== null) {
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
    manualOverride = isNight() ? 'day' : 'night';
    apply();
  });

  apply();

  return {
    apply,
    isNight,
    setUserMode,
    getUserMode,
    hasManualOverride,
    isScheduledNight,
    getJerusalemHour,
  };
})();
