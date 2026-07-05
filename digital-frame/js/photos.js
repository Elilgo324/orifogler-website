(function initPhotos() {
  const DB_NAME = 'digital-frame';
  const DB_VERSION = 2;
  const STORE_NAME = 'photos';
  const HEIC_EXTENSIONS = /\.(heic|heif)$/i;
  const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif)$/i;
  const JPEG_QUALITY = 0.9;
  const HEIC2ANY_URL = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';

  const stage = document.getElementById('photo-stage');
  const dropOverlay = document.getElementById('drop-overlay');
  const processingState = document.getElementById('processing-state');
  const statusMsg = document.getElementById('status-msg');
  const fileInput = document.getElementById('file-input');
  const clearButton = document.getElementById('clear-photos');

  const objectUrls = new Map();
  let processingCount = 0;
  let heic2anyPromise = null;

  function newId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function prefersNativeHeic() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
    return isIOS || (isSafari && /Macintosh/.test(ua));
  }

  function mimeFromName(name) {
    const lower = (name || '').toLowerCase();
    if (/\.jpe?g$/.test(lower)) return 'image/jpeg';
    if (/\.png$/.test(lower)) return 'image/png';
    if (/\.gif$/.test(lower)) return 'image/gif';
    if (/\.webp$/.test(lower)) return 'image/webp';
    if (/\.bmp$/.test(lower)) return 'image/bmp';
    if (/\.svg$/.test(lower)) return 'image/svg+xml';
    if (/\.avif$/.test(lower)) return 'image/avif';
    if (HEIC_EXTENSIONS.test(lower)) return 'image/heic';
    return '';
  }

  function mimeFromBytes(bytes) {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image/png';
    }
    if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
    if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return 'image/webp';
    }
    return '';
  }

  async function detectMimeType(file) {
    const declared = (file.type || '').toLowerCase();
    if (declared.startsWith('image/')) {
      return declared;
    }

    const fromName = mimeFromName(file.name);
    if (fromName) {
      return fromName;
    }

    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const fromBytes = mimeFromBytes(header);
    if (fromBytes) {
      return fromBytes;
    }

    if (isHeicFile(file)) {
      return 'image/heic';
    }

    return 'image/jpeg';
  }

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

  async function recordToBlob(record) {
    if (record.data) {
      const mimeType = record.mimeType || mimeFromName(record.name) || 'image/jpeg';
      return new Blob([record.data], { type: mimeType });
    }

    if (record.blob instanceof Blob) {
      const mimeType = record.blob.type || record.mimeType || mimeFromName(record.name) || 'image/jpeg';
      if (record.blob.type === mimeType) {
        return record.blob;
      }
      return new Blob([await record.blob.arrayBuffer()], { type: mimeType });
    }

    throw new Error(`Invalid photo record ${record.id}`);
  }

  async function recordsToUrls(records) {
    revokeAllUrls();
    const urls = [];

    for (const record of records) {
      const blob = await recordToBlob(record);
      const url = URL.createObjectURL(blob);
      objectUrls.set(record.id, url);
      urls.push(url);
    }

    return urls;
  }

  function isHeicFile(file) {
    const type = (file.type || '').toLowerCase();
    if (type.includes('heic') || type.includes('heif')) {
      return true;
    }
    return HEIC_EXTENSIONS.test(file.name || '');
  }

  function isImageFile(file) {
    if ((file.type || '').startsWith('image/')) {
      return true;
    }
    if (isHeicFile(file)) {
      return true;
    }
    return IMAGE_EXTENSIONS.test(file.name || '');
  }

  function jpegNameFrom(fileName) {
    return (fileName || 'photo.heic').replace(HEIC_EXTENSIONS, '.jpg');
  }

  function showStatus(message) {
    if (!message) {
      statusMsg.hidden = true;
      statusMsg.textContent = '';
      return;
    }
    statusMsg.textContent = message;
    statusMsg.hidden = false;
  }

  function loadHeic2Any() {
    if (typeof heic2any === 'function') {
      return Promise.resolve(heic2any);
    }
    if (heic2anyPromise) {
      return heic2anyPromise;
    }

    heic2anyPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = HEIC2ANY_URL;
      script.async = true;
      script.onload = () => {
        if (typeof heic2any === 'function') {
          resolve(heic2any);
          return;
        }
        reject(new Error('HEIC converter failed to initialize'));
      };
      script.onerror = () => reject(new Error('HEIC converter failed to load'));
      document.head.appendChild(script);
    });

    return heic2anyPromise;
  }

  async function convertHeicToJpeg(file, mimeType) {
    const converter = await loadHeic2Any();
    const converted = await converter({
      blob: file instanceof Blob ? file : new Blob([file], { type: mimeType }),
      toType: 'image/jpeg',
      quality: JPEG_QUALITY,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return {
      name: jpegNameFrom(file.name),
      mimeType: 'image/jpeg',
      data: await blob.arrayBuffer(),
    };
  }

  async function normalizeImageFile(file) {
    const mimeType = await detectMimeType(file);

    if (!isHeicFile({ name: file.name, type: mimeType })) {
      return {
        name: file.name || 'photo.jpg',
        mimeType,
        data: await file.arrayBuffer(),
      };
    }

    if (prefersNativeHeic()) {
      return {
        name: file.name || 'photo.heic',
        mimeType: mimeType || 'image/heic',
        data: await file.arrayBuffer(),
      };
    }

    try {
      return await convertHeicToJpeg(file, mimeType);
    } catch (error) {
      console.warn(`HEIC conversion failed for ${file.name}, using original`, error);
      return {
        name: file.name || 'photo.heic',
        mimeType: mimeType || 'image/heic',
        data: await file.arrayBuffer(),
      };
    }
  }

  async function normalizeStoredRecord(record) {
    const blob = await recordToBlob(record);
    const mimeType = record.mimeType || blob.type || mimeFromName(record.name);

    if (!isHeicFile({ name: record.name, type: mimeType })) {
      return {
        id: record.id,
        name: record.name,
        mimeType,
        data: record.data || (await blob.arrayBuffer()),
        addedAt: record.addedAt,
      };
    }

    if (prefersNativeHeic()) {
      return {
        id: record.id,
        name: record.name,
        mimeType: mimeType || 'image/heic',
        data: record.data || (await blob.arrayBuffer()),
        addedAt: record.addedAt,
      };
    }

    const source = new File([blob], record.name || 'photo.heic', {
      type: mimeType || 'image/heic',
    });

    try {
      const converted = await convertHeicToJpeg(source, mimeType);
      return {
        id: record.id,
        name: converted.name,
        mimeType: converted.mimeType,
        data: converted.data,
        addedAt: record.addedAt,
      };
    } catch (error) {
      console.warn(`Stored HEIC conversion failed for ${record.name}`, error);
      return {
        id: record.id,
        name: record.name,
        mimeType: mimeType || 'image/heic',
        data: record.data || (await blob.arrayBuffer()),
        addedAt: record.addedAt,
      };
    }
  }

  function setProcessing(active) {
    processingCount += active ? 1 : -1;
    processingState.hidden = processingCount <= 0;
  }

  async function withProcessing(task) {
    setProcessing(true);
    try {
      return await task();
    } finally {
      setProcessing(false);
    }
  }

  async function refreshSlideshow(db) {
    const records = await getAllPhotos(db);
    const urls = await recordsToUrls(records);
    Slideshow.start(urls);
    FrameMode.apply();
    return { records, urls };
  }

  async function addFiles(files) {
    const imageFiles = Array.from(files).filter(isImageFile);
    if (imageFiles.length === 0) {
      showStatus('No supported image files found. Try JPEG, PNG, or HEIC.');
      return;
    }

    showStatus('');

    await withProcessing(async () => {
      const db = await openDb();
      let addedCount = 0;

      for (const file of imageFiles) {
        try {
          const normalized = await normalizeImageFile(file);
          await putPhoto(db, {
            id: newId(),
            name: normalized.name,
            mimeType: normalized.mimeType,
            data: normalized.data,
            addedAt: Date.now(),
          });
          addedCount += 1;
        } catch (error) {
          console.error(`Failed to add ${file.name}`, error);
        }
      }

      const { records, urls } = await refreshSlideshow(db);

      if (addedCount === 0) {
        showStatus('Could not add photos. Try again or use JPEG/PNG files.');
        return;
      }

      if (urls.length === 0) {
        showStatus('Photos were saved but could not be displayed. Tap Clear and try again.');
        return;
      }

      if (records.length > 0 && urls.length < records.length) {
        showStatus('Some photos could not be displayed.');
      }
    });
  }

  async function loadStoredPhotos() {
    const db = await openDb();
    let records = await getAllPhotos(db);

    const needsMigration = records.some((record) => !record.data || record.blob);
    if (needsMigration && records.length > 0) {
      await withProcessing(async () => {
        const migrated = [];
        for (const record of records) {
          migrated.push(await normalizeStoredRecord(record));
        }
        for (const record of migrated) {
          await putPhoto(db, record);
        }
        records = migrated.sort((a, b) => a.addedAt - b.addedAt);
      });
    }

    const urls = await recordsToUrls(records);
    Slideshow.start(urls);
    FrameMode.apply();

    if (records.length > 0 && urls.length === 0) {
      showStatus('Saved photos could not be loaded. Tap Clear and add them again.');
    }
  }

  async function clearPhotos() {
    if (!window.confirm('Remove all photos from this device?')) {
      return;
    }

    const db = await openDb();
    await clearStore(db);
    revokeAllUrls();
    showStatus('');
    Slideshow.start([]);
    FrameMode.apply();
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

  clearButton.addEventListener('click', (event) => {
    event.stopPropagation();
    clearPhotos();
  });

  window.addEventListener('slideshow-empty', () => {
    showStatus('Photos could not be displayed. Tap Clear, then add JPEG or PNG files.');
  });

  loadStoredPhotos().catch((error) => {
    console.error('Failed to load stored photos', error);
    showStatus('Could not load saved photos on this device.');
    Slideshow.start([]);
    FrameMode.apply();
  });
})();
