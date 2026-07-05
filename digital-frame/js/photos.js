(function initPhotos() {
  const DB_NAME = 'digital-frame';
  const DB_VERSION = 1;
  const STORE_NAME = 'photos';

  const stage = document.getElementById('photo-stage');
  const dropOverlay = document.getElementById('drop-overlay');
  const fileInput = document.getElementById('file-input');
  const chooseButton = document.getElementById('choose-photos');
  const addButton = document.getElementById('add-photos');
  const clearButton = document.getElementById('clear-photos');

  const objectUrls = new Map();

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  function getAllPhotos(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const records = request.result.sort((a, b) => a.addedAt - b.addedAt);
        resolve(records);
      };
    });
  }

  function putPhoto(db, record) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  function clearStore(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  function revokeAllUrls() {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  }

  function recordsToUrls(records) {
    revokeAllUrls();
    return records.map((record) => {
      const url = URL.createObjectURL(record.blob);
      objectUrls.set(record.id, url);
      return url;
    });
  }

  function isImageFile(file) {
    return file.type.startsWith('image/');
  }

  async function addFiles(files) {
    const imageFiles = Array.from(files).filter(isImageFile);
    if (imageFiles.length === 0) {
      return;
    }

    const db = await openDb();
    for (const file of imageFiles) {
      await putPhoto(db, {
        id: crypto.randomUUID(),
        name: file.name,
        blob: file,
        addedAt: Date.now(),
      });
    }

    const records = await getAllPhotos(db);
    Slideshow.start(recordsToUrls(records));
  }

  async function loadStoredPhotos() {
    const db = await openDb();
    const records = await getAllPhotos(db);
    Slideshow.start(recordsToUrls(records));
  }

  async function clearPhotos() {
    if (!window.confirm('Remove all photos from this device?')) {
      return;
    }

    const db = await openDb();
    await clearStore(db);
    revokeAllUrls();
    Slideshow.start([]);
  }

  function openFilePicker() {
    fileInput.click();
  }

  function showDropOverlay() {
    dropOverlay.hidden = false;
    stage.classList.add('drag-over');
  }

  function hideDropOverlay() {
    dropOverlay.hidden = true;
    stage.classList.remove('drag-over');
  }

  stage.addEventListener('dragenter', (event) => {
    event.preventDefault();
    showDropOverlay();
  });

  stage.addEventListener('dragover', (event) => {
    event.preventDefault();
    showDropOverlay();
  });

  stage.addEventListener('dragleave', (event) => {
    if (!stage.contains(event.relatedTarget)) {
      hideDropOverlay();
    }
  });

  stage.addEventListener('drop', (event) => {
    event.preventDefault();
    hideDropOverlay();
    addFiles(event.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });

  chooseButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openFilePicker();
  });

  addButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openFilePicker();
  });

  clearButton.addEventListener('click', (event) => {
    event.stopPropagation();
    clearPhotos();
  });

  loadStoredPhotos().catch((error) => {
    console.error('Failed to load stored photos', error);
    Slideshow.start([]);
  });
})();
