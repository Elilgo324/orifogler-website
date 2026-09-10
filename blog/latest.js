(function () {
  "use strict";

  const lead = document.getElementById("latest-article");
  const meta = document.getElementById("latest-meta");
  const title = document.getElementById("latest-title");
  const excerpt = document.getElementById("latest-excerpt");
  const openButton = document.getElementById("latest-open");
  const fallbackLink = document.getElementById("latest-fallback");
  const dialog = document.getElementById("latest-dialog");
  const closeButton = document.getElementById("latest-close");
  const dialogTitle = document.getElementById("latest-dialog-title");
  const dialogDate = document.getElementById("latest-dialog-date");
  const dialogBody = document.getElementById("latest-dialog-body");
  const bloggerLink = document.getElementById("latest-blogger-link");
  let latestArticle = null;

  function paragraphsFromHtml(html, articleTitle) {
    const container = document.createElement("div");
    container.innerHTML = html;
    container.querySelectorAll("script, style, iframe, object, embed, form, noscript").forEach((node) => node.remove());
    const paragraphs = Array.from(container.querySelectorAll("p, h2, h3, h4, blockquote, li"))
      .map((node) => node.textContent.replace(/\s+/g, " ").trim())
      .filter((text) => text && text !== articleTitle);
    if (paragraphs.length) return paragraphs;
    const text = container.textContent.replace(/\s+/g, " ").trim();
    return text && text !== articleTitle ? [text] : [];
  }

  function formattedDate(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jerusalem",
    }).format(date);
  }

  function shortened(text, maximum = 430) {
    if (text.length <= maximum) return text;
    const slice = text.slice(0, maximum);
    const lastSpace = slice.lastIndexOf(" ");
    return `${slice.slice(0, lastSpace > maximum * 0.75 ? lastSpace : maximum).trim()}…`;
  }

  function showFailure() {
    if (latestArticle) return;
    meta.textContent = "המאמר האחרון";
    title.textContent = "לא ניתן לטעון כרגע את המאמר האחרון";
    excerpt.textContent = "אפשר לקרוא אותו ישירות בבלוג המקורי.";
    excerpt.classList.remove("latest-loading");
    fallbackLink.hidden = false;
    lead.setAttribute("aria-busy", "false");
  }

  function openArticle() {
    if (!latestArticle) return;
    dialogTitle.textContent = latestArticle.title;
    dialogDate.textContent = formattedDate(latestArticle.date);
    dialogDate.dateTime = latestArticle.date ? latestArticle.date.toISOString() : "";
    bloggerLink.href = latestArticle.sourceUrl;
    dialogBody.replaceChildren();
    const fragment = document.createDocumentFragment();
    latestArticle.paragraphs.forEach((text) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      fragment.appendChild(paragraph);
    });
    dialogBody.appendChild(fragment);
    document.body.classList.add("dialog-open");
    if (!dialog.open) dialog.showModal();
  }

  function closeArticle() {
    if (dialog.open) dialog.close();
    document.body.classList.remove("dialog-open");
  }

  window.renderLatestHagigey = function (data) {
    const entry = data?.feed?.entry?.[0];
    if (!entry) {
      showFailure();
      return;
    }

    const articleTitle = entry.title?.$t?.trim() || "מאמר ללא כותרת";
    const published = entry.published?.$t || entry.updated?.$t || "";
    const parsedDate = published ? new Date(published) : null;
    const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    const content = entry.content?.$t ?? entry.summary?.$t ?? "";
    const paragraphs = paragraphsFromHtml(content, articleTitle);
    const sourceUrl = (entry.link || []).find((link) => link.rel === "alternate")?.href || "https://hagigey.blogspot.com/";

    latestArticle = { title: articleTitle, date, paragraphs, sourceUrl };
    meta.textContent = `המאמר האחרון${date ? ` · ${formattedDate(date)}` : ""}`;
    title.textContent = articleTitle;
    excerpt.textContent = shortened(paragraphs.join(" "));
    excerpt.classList.remove("latest-loading");
    openButton.hidden = paragraphs.length === 0;
    fallbackLink.href = sourceUrl;
    fallbackLink.hidden = paragraphs.length > 0;
    lead.setAttribute("aria-busy", "false");
  };

  openButton.addEventListener("click", openArticle);
  closeButton.addEventListener("click", closeArticle);
  dialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeArticle();
  });
  window.setTimeout(showFailure, 12000);
}());
