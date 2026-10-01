// Include all technical notes in print, then restore the reader's choices.
(() => {
  let closedNotes = [];
  window.addEventListener('beforeprint', () => {
    if (closedNotes.length) return;
    closedNotes = [...document.querySelectorAll('.method-note:not([open])')];
    closedNotes.forEach(note => { note.open = true; });
  });
  window.addEventListener('afterprint', () => {
    closedNotes.forEach(note => { note.open = false; });
    closedNotes = [];
  });
})();
