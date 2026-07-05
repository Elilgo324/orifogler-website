(function initFullscreen() {
  const enterButton = document.getElementById('enter-fullscreen');
  const exitButton = document.getElementById('exit-fullscreen');
  const root = document.documentElement;

  function nativeSupported() {
    return Boolean(
      document.documentElement.requestFullscreen
      || document.documentElement.webkitRequestFullscreen,
    );
  }

  function isNativeFullscreen() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function isFrameFullscreen() {
    return document.body.classList.contains('fullscreen-active');
  }

  function isFullscreen() {
    return isNativeFullscreen() || isFrameFullscreen();
  }

  function updateButtons() {
    const active = isFullscreen();
    enterButton.hidden = active;
    exitButton.hidden = !active;
  }

  async function requestNativeFullscreen() {
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) {
      return false;
    }
    await request.call(root);
    return true;
  }

  async function exitNativeFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (!exit || !isNativeFullscreen()) {
      return false;
    }
    await exit.call(document);
    return true;
  }

  function enterFrameMode() {
    document.body.classList.add('fullscreen-active');
  }

  function exitFrameMode() {
    document.body.classList.remove('fullscreen-active');
  }

  async function enterFullscreen() {
    try {
      if (nativeSupported()) {
        await requestNativeFullscreen();
        return;
      }
    } catch (error) {
      console.warn('Native fullscreen failed, using frame mode', error);
    }
    enterFrameMode();
    updateButtons();
  }

  async function exitFullscreen() {
    try {
      await exitNativeFullscreen();
    } catch (error) {
      console.warn('Native fullscreen exit failed', error);
    }
    exitFrameMode();
    updateButtons();
  }

  enterButton.addEventListener('click', (event) => {
    event.stopPropagation();
    enterFullscreen();
  });

  exitButton.addEventListener('click', (event) => {
    event.stopPropagation();
    exitFullscreen();
  });

  document.addEventListener('fullscreenchange', updateButtons);
  document.addEventListener('webkitfullscreenchange', updateButtons);

  updateButtons();
})();
