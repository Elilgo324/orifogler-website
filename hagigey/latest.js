(function () {
  "use strict";

  const lead = document.getElementById("latest-article");
  const meta = document.getElementById("latest-meta");
  const title = document.getElementById("latest-title");
  const excerpt = document.getElementById("latest-excerpt");
  const actions = document.getElementById("latest-actions");
  const openButton = document.getElementById("latest-open");
  const shareButton = document.getElementById("latest-share");
  const fallbackLink = document.getElementById("latest-fallback");
  const dialog = document.getElementById("latest-dialog");
  const closeButton = document.getElementById("latest-close");
  const dialogTitle = document.getElementById("latest-dialog-title");
  const dialogDate = document.getElementById("latest-dialog-date");
  const dialogBody = document.getElementById("latest-dialog-body");
  const bloggerLink = document.getElementById("latest-blogger-link");
  let latestArticle = null;
  const pageTitle = document.title;

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

  function articleFromEntry(entry) {
    const articleTitle = entry.title?.$t?.trim() || "מאמר ללא כותרת";
    const published = entry.published?.$t || entry.updated?.$t || "";
    const parsedDate = published ? new Date(published) : null;
    const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    const content = entry.content?.$t ?? entry.summary?.$t ?? "";
    return {
      id: entry.id?.$t?.match(/post-(\d+)/)?.[1] || "",
      title: articleTitle,
      date,
      paragraphs: paragraphsFromHtml(content, articleTitle),
      sourceUrl: (entry.link || []).find((link) => link.rel === "alternate")?.href || "https://hagigey.blogspot.com/",
    };
  }

  function articleUrl(article) {
    const url = new URL(window.location.href);
    url.searchParams.set("article", article.id);
    url.hash = "";
    return url.toString();
  }

  function clearArticleFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("article");
    window.history.replaceState(null, "", url);
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

  function openArticle(article = latestArticle, updateUrl = true) {
    if (!article) return;
    document.title = `${article.title} | הגיגי אמרי`;
    dialogTitle.textContent = article.title;
    dialogDate.textContent = formattedDate(article.date);
    dialogDate.dateTime = article.date ? article.date.toISOString() : "";
    bloggerLink.href = article.sourceUrl;
    dialogBody.replaceChildren();
    const fragment = document.createDocumentFragment();
    article.paragraphs.forEach((text) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      fragment.appendChild(paragraph);
    });
    dialogBody.appendChild(fragment);
    document.body.classList.add("dialog-open");
    if (!dialog.open) dialog.showModal();
    if (updateUrl && article.id) window.history.replaceState(null, "", articleUrl(article));
  }

  function closeArticle() {
    if (dialog.open) dialog.close();
    document.body.classList.remove("dialog-open");
  }

  function copyFallback(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }

  async function shareLatest() {
    if (!latestArticle?.id) return;
    const url = articleUrl(latestArticle);
    try {
      if (navigator.share) {
        await navigator.share({ title: latestArticle.title, text: `${latestArticle.title} — הגיגי אמרי`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch (error) {
      if (error?.name === "AbortError") return;
      copyFallback(url);
    }
    const originalText = shareButton.textContent;
    shareButton.textContent = "הקישור הועתק";
    window.setTimeout(() => { shareButton.textContent = originalText; }, 1800);
  }

  function loadSharedArticle(id) {
    if (!/^\d+$/.test(id)) return;
    const script = document.createElement("script");
    script.src = `https://hagigey.blogspot.com/feeds/posts/default/${encodeURIComponent(id)}?alt=json-in-script&callback=renderSharedHagigey`;
    script.addEventListener("load", () => script.remove());
    script.addEventListener("error", () => script.remove());
    document.body.appendChild(script);
  }

  window.renderLatestHagigey = function (data) {
    const entry = data?.feed?.entry?.[0];
    if (!entry) {
      showFailure();
      return;
    }

    latestArticle = articleFromEntry(entry);
    meta.textContent = `המאמר האחרון${latestArticle.date ? ` · ${formattedDate(latestArticle.date)}` : ""}`;
    title.textContent = latestArticle.title;
    excerpt.textContent = shortened(latestArticle.paragraphs.join(" "));
    excerpt.classList.remove("latest-loading");
    actions.hidden = latestArticle.paragraphs.length === 0;
    fallbackLink.href = latestArticle.sourceUrl;
    fallbackLink.hidden = latestArticle.paragraphs.length > 0;
    lead.setAttribute("aria-busy", "false");

    const requestedId = new URL(window.location.href).searchParams.get("article");
    if (requestedId === latestArticle.id) openArticle(latestArticle, false);
    else if (requestedId) loadSharedArticle(requestedId);
  };

  window.renderSharedHagigey = function (data) {
    const entry = data?.entry;
    if (entry) openArticle(articleFromEntry(entry), false);
  };

  openButton.addEventListener("click", () => openArticle());
  shareButton.addEventListener("click", shareLatest);
  closeButton.addEventListener("click", closeArticle);
  dialog.addEventListener("close", () => {
    document.title = pageTitle;
    document.body.classList.remove("dialog-open");
    clearArticleFromUrl();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeArticle();
  });
  window.setTimeout(showFailure, 12000);
}());
