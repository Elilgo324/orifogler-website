(function () {
  "use strict";

  let printCopy = null;
  let sourceNote = null;

  function cleanUp() {
    printCopy?.remove();
    sourceNote?.remove();
    printCopy = null;
    sourceNote = null;
    document.body.classList.remove("printing-dialog");
  }

  function preparePrint() {
    cleanUp();
    const dialog = document.querySelector("#latest-dialog[open]");
    let content;
    let source = document.querySelector('link[rel="canonical"]')?.href || location.href;

    if (dialog) {
      // Print a normal document flow, not a viewport-sized modal scroll area.
      printCopy = document.createElement("div");
      printCopy.className = "print-dialog-content";
      const article = dialog.querySelector(".latest-reading").cloneNode(true);
      article.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
      printCopy.appendChild(article);
      document.body.appendChild(printCopy);
      document.body.classList.add("printing-dialog");
      content = article;
      source = document.getElementById("latest-blogger-link").href;
    } else {
      content = document.querySelector(".article-content")
        || document.querySelector("main > article")
        || document.querySelector("main");
    }

    if (content) {
      sourceNote = document.createElement("p");
      sourceNote.className = "print-source";
      const author = document.createElement("span");
      author.textContent = document.documentElement.lang === "he" ? "אורי פוגלר" : "Ori Fogler";
      const link = document.createElement("a");
      link.href = source;
      link.textContent = source;
      link.dir = "ltr";
      sourceNote.append(author, document.createElement("br"), link);
      content.appendChild(sourceNote);
    }
  }

  document.querySelectorAll("[data-print]").forEach((button) => {
    button.hidden = false;
    button.addEventListener("click", () => window.print());
  });
  // Native keyboard/menu printing uses the same layout as the buttons.
  window.addEventListener("beforeprint", preparePrint);
  window.addEventListener("afterprint", cleanUp);
}());
