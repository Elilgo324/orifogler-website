(function initSlideshow() {
  const photos = Array.isArray(CONFIG.photos) ? CONFIG.photos.filter(Boolean) : [];
  const slideA = document.getElementById('slide-a');
  const slideB = document.getElementById('slide-b');
  const emptyState = document.getElementById('empty-state');
  const stage = document.getElementById('photo-stage');

  const slideDurationMs = CONFIG.slideDurationMs || 7000;
  const transitionMs = CONFIG.transitionMs || 1500;
  const shuffle = CONFIG.shuffle !== false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.style.setProperty('--slide-duration', `${slideDurationMs}ms`);
  document.documentElement.style.setProperty('--transition-ms', `${transitionMs}ms`);

  if (photos.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  let order = photos.map((url, index) => index);
  let position = 0;
  let activeSlide = slideA;
  let idleSlide = slideB;
  let timerId = null;

  function shuffleOrder() {
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }

  if (shuffle) {
    shuffleOrder();
  }

  function photoUrl(index) {
    return photos[order[index]];
  }

  function swapSlides() {
    activeSlide.classList.remove('visible', 'ken-burns');
    idleSlide.classList.add('visible');
    if (!reducedMotion) {
      idleSlide.classList.add('ken-burns');
    }

    const previous = activeSlide;
    activeSlide = idleSlide;
    idleSlide = previous;
  }

  function preload(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
    });
  }

  function nextIndex(current) {
    const next = current + 1;
    if (next < order.length) {
      return next;
    }
    if (shuffle) {
      shuffleOrder();
    }
    return 0;
  }

  async function showPhoto(index) {
    const url = photoUrl(index);
    try {
      await preload(url);
    } catch (error) {
      console.warn(error.message);
      const fallback = nextIndex(index);
      if (fallback !== index || order.length > 1) {
        position = fallback;
        await showPhoto(position);
      }
      return;
    }

    idleSlide.src = url;
    idleSlide.alt = 'Album photo';
    swapSlides();
    position = nextIndex(index);

    const upcoming = photoUrl(position);
    preload(upcoming).catch(() => {});

    clearTimeout(timerId);
    timerId = setTimeout(() => {
      showPhoto(position);
    }, slideDurationMs);
  }

  slideA.addEventListener('error', () => {
    console.warn('Active slide failed to render');
  });

  slideB.addEventListener('error', () => {
    console.warn('Idle slide failed to render');
  });

  stage.addEventListener('click', () => {
    clearTimeout(timerId);
    showPhoto(position);
  });

  showPhoto(0);
})();
