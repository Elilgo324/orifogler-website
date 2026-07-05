window.Slideshow = (function createSlideshowModule() {
  const slideDurationMs = CONFIG.slideDurationMs || 60000;
  const transitionMs = CONFIG.transitionMs || 1500;
  const shuffle = CONFIG.shuffle !== false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slideA = document.getElementById('slide-a');
  const slideB = document.getElementById('slide-b');
  const emptyState = document.getElementById('empty-state');
  const toolbar = document.getElementById('toolbar');

  document.documentElement.style.setProperty('--slide-duration', `${slideDurationMs}ms`);
  document.documentElement.style.setProperty('--transition-ms', `${transitionMs}ms`);

  let photos = [];
  let order = [];
  let position = 0;
  let activeSlide = slideA;
  let idleSlide = slideB;
  let timerId = null;
  let failedUrls = new Set();

  function shuffleOrder() {
    order = photos.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }

  function photoUrl(index) {
    return photos[order[index]];
  }

  function swapSlides() {
    activeSlide.classList.remove('visible', 'ken-burns');
    idleSlide.classList.add('visible');
    if (!reducedMotion) {
      void idleSlide.offsetWidth;
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

  function setUiState(hasPhotos) {
    emptyState.hidden = hasPhotos;
    toolbar.hidden = !hasPhotos;
  }

  function stop() {
    clearTimeout(timerId);
    timerId = null;
  }

  async function showPhoto(index, attempt = 0) {
    if (photos.length === 0) {
      stop();
      setUiState(false);
      return;
    }

    if (attempt >= photos.length) {
      console.warn('All photos failed to load');
      stop();
      setUiState(false);
      slideA.removeAttribute('src');
      slideB.removeAttribute('src');
      slideA.classList.remove('visible', 'ken-burns');
      slideB.classList.remove('visible', 'ken-burns');
      window.dispatchEvent(new CustomEvent('slideshow-empty'));
      return;
    }

    const url = photoUrl(index);
    if (failedUrls.has(url)) {
      position = nextIndex(index);
      await showPhoto(position, attempt + 1);
      return;
    }

    try {
      await preload(url);
    } catch (error) {
      console.warn(error.message);
      failedUrls.add(url);
      position = nextIndex(index);
      await showPhoto(position, attempt + 1);
      return;
    }

    idleSlide.src = url;
    idleSlide.alt = 'Photo';
    swapSlides();
    position = nextIndex(index);

    const upcoming = photoUrl(position);
    if (!failedUrls.has(upcoming)) {
      preload(upcoming).catch(() => {});
    }

    stop();
    timerId = setTimeout(() => {
      showPhoto(position, 0);
    }, slideDurationMs);
  }

  function start(photoUrls) {
    stop();
    failedUrls = new Set();
    photos = photoUrls.slice();
    if (photos.length === 0) {
      slideA.removeAttribute('src');
      slideB.removeAttribute('src');
      slideA.classList.remove('visible', 'ken-burns');
      slideB.classList.remove('visible', 'ken-burns');
      setUiState(false);
      return;
    }

    setUiState(true);
    if (shuffle) {
      shuffleOrder();
    } else {
      order = photos.map((_, index) => index);
    }
    position = 0;
    showPhoto(0);
  }

  function skip() {
    if (photos.length === 0) {
      return;
    }
    stop();
    showPhoto(position);
  }

  slideA.addEventListener('error', () => {
    console.warn('Active slide failed to render');
  });

  slideB.addEventListener('error', () => {
    console.warn('Idle slide failed to render');
  });

  document.getElementById('photo-stage').addEventListener('click', (event) => {
    if (event.target.closest('.btn')) {
      return;
    }
    skip();
  });

  return { start, skip, stop };
})();
