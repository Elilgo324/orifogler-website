#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_DIR = join(ROOT, "blog", "posts");
const ADSENSE_ID = "ca-pub-9772429963587397";
const SITE = "https://orifogler.com";
const inputIndex = process.argv.indexOf("--input");
const inputFile = inputIndex >= 0 ? process.argv[inputIndex + 1] : null;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeEntities(value = "") {
  const named = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
    ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…",
  };
  return value
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function plainText(value = "") {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function articleBlocks(html, title) {
  const safe = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<(iframe|object|embed|form|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const matches = safe.matchAll(/<(p|h[2-4]|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi);
  const blocks = [];
  for (const match of matches) {
    const text = plainText(match[2]);
    if (!text || (blocks.length === 0 && text === title)) continue;
    const sourceTag = match[1].toLowerCase();
    const tag = sourceTag.startsWith("h") ? "h2" : sourceTag === "blockquote" ? "blockquote" : "p";
    blocks.push(`<${tag}>${escapeHtml(text)}</${tag}>`);
  }
  if (!blocks.length) {
    const text = plainText(safe);
    if (text && text !== title) blocks.push(`<p>${escapeHtml(text)}</p>`);
  }
  return blocks;
}

function postFromEntry(entry) {
  const title = entry.title?.$t?.trim() || "מאמר ללא כותרת";
  const published = entry.published?.$t || entry.updated?.$t || "";
  const id = entry.id?.$t?.match(/post-(\d+)/)?.[1];
  if (!id) return null;
  const sourceHtml = entry.content?.$t ?? entry.summary?.$t ?? "";
  const blocks = articleBlocks(sourceHtml, title);
  const text = blocks.map(plainText).join(" ");
  return {
    id,
    title,
    published,
    date: new Date(published),
    blocks,
    text,
    labels: (entry.category ?? []).map((category) => category.term).filter(Boolean),
    sourceUrl: (entry.link ?? []).find((link) => link.rel === "alternate")?.href ?? "",
  };
}

function excerpt(text, max = 220) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > max * 0.75 ? lastSpace : max).trim()}…`;
}

function hebrewDate(date) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jerusalem",
  }).format(date);
}

function adSenseCode() {
  return `<meta name="google-adsense-account" content="${ADSENSE_ID}" />\n  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}" crossorigin="anonymous"></script>`;
}

function topNav(prefix = "../") {
  return `<nav class="site-nav" aria-label="ניווט ראשי">
    <a href="${prefix}index.html">ראשי</a>
    <a href="${prefix}blog/" aria-current="page">בלוג</a>
    <a href="${prefix}books.html">ספרים</a>
    <a href="${prefix}about.html">אודות</a>
  </nav>`;
}

function footer(prefix = "../") {
  return `<footer><div class="shell footer-inner">
    <span>© ${new Date().getFullYear()} אורי פוגלר</span>
    <a href="${prefix}about.html">אודות הכותב</a>
    <a href="${prefix}privacy.html">מדיניות פרטיות</a>
    <a href="mailto:me@orifogler.com">יצירת קשר</a>
  </div></footer>`;
}

function cards(posts) {
  return posts.map((post, index) => `<article class="post-card${index === 0 ? " featured" : ""}">
        <time datetime="${escapeHtml(post.published)}">${escapeHtml(hebrewDate(post.date))}</time>
        <h2><a href="posts/${post.id}.html">${escapeHtml(post.title)}</a></h2>
        <p>${escapeHtml(excerpt(post.text, index === 0 ? 300 : 190))}</p>
        <a class="read-more" href="posts/${post.id}.html" aria-label="קריאת המאמר ${escapeHtml(post.title)}">לקריאת המאמר ←</a>
      </article>`).join("\n");
}

function blogIndex(posts) {
  const latest = posts.slice(0, 13);
  latest.shift();
  const leadHtml = `<article class="lead" id="latest-article" aria-live="polite" aria-busy="true">
      <p class="eyebrow" id="latest-meta">המאמר האחרון · נטען מ-Blogger</p>
      <h1 id="latest-title">טוען את המאמר האחרון…</h1>
      <p class="lead-copy latest-loading" id="latest-excerpt">המאמר החדש ביותר יופיע כאן באופן אוטומטי.</p>
      <button class="primary-link latest-open" id="latest-open" type="button" hidden>לקריאת המאמר המלא ←</button>
      <a class="primary-link" id="latest-fallback" href="https://hagigey.blogspot.com/" hidden>לבלוג המקורי ←</a>
      <noscript><p><a class="primary-link" href="https://hagigey.blogspot.com/">למאמר האחרון ב-Blogger ←</a></p></noscript>
    </article>`;
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#173d39" />
  <title>הגיגי אמרי — מאמרים בפרשת השבוע מאת אורי פוגלר</title>
  <meta name="description" content="מאמרים מקוריים בפרשת השבוע, תלמוד והלכה מאת אורי פוגלר. ארכיון של ${posts.length} מאמרים לקריאה חופשית." />
  <link rel="canonical" href="${SITE}/blog/" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="he_IL" />
  <meta property="og:title" content="הגיגי אמרי — מאמרים בפרשת השבוע" />
  <meta property="og:description" content="מאמרים מקוריים בפרשת השבוע, תלמוד והלכה מאת אורי פוגלר." />
  <meta property="og:url" content="${SITE}/blog/" />
  <link rel="icon" href="../favicon.svg" type="image/svg+xml" />
  ${adSenseCode()}
  <link rel="stylesheet" href="article.css" />
  <link rel="stylesheet" href="latest.css" />
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "Blog", name: "הגיגי אמרי",
    url: `${SITE}/blog/`, inLanguage: "he", author: { "@type": "Person", name: "אורי פוגלר", url: `${SITE}/about.html` },
  }).replaceAll("<", "\\u003c")}</script>
</head>
<body class="blog-home">
  <a class="skip-link" href="#content">דילוג לתוכן</a>
  <header class="masthead"><div class="shell">${topNav("../")}
    <p class="brand">הגיגי אמרי</p>
    <p class="tagline">עיון שבועי בתורה, בתלמוד ובהלכה</p>
  </div></header>
  <main id="content" class="shell blog-main">
    ${leadHtml}
    <section class="recent" aria-labelledby="recent-title">
      <div class="section-heading"><div><p class="eyebrow">מן הארכיון</p><h2 id="recent-title">מאמרים אחרונים</h2></div><a href="archive.html">לכל ${posts.length} המאמרים ←</a></div>
      <div class="post-grid">${cards(latest)}</div>
    </section>
    <aside class="books-callout"><div><p class="eyebrow">להעמקה נוספת</p><h2>שני ספרים לקריאה חופשית</h2><p>מאות עמודים של מאמרים והגיגים על פרשיות השבוע, מועדי ישראל וסוגיות תלמודיות.</p></div><a class="primary-link" href="../books.html">לספרייה הדיגיטלית ←</a></aside>
  </main>
  <dialog class="latest-dialog" id="latest-dialog" aria-labelledby="latest-dialog-title">
    <div class="latest-dialog-bar">
      <a id="latest-blogger-link" href="https://hagigey.blogspot.com/" target="_blank" rel="noopener">פתיחה ב-Blogger</a>
      <button id="latest-close" type="button" aria-label="סגירת המאמר">×</button>
    </div>
    <article class="latest-reading">
      <time id="latest-dialog-date"></time>
      <h2 id="latest-dialog-title"></h2>
      <div class="latest-body" id="latest-dialog-body"></div>
    </article>
  </dialog>
  ${footer("../")}
  <script src="latest.js"></script>
  <script src="https://hagigey.blogspot.com/feeds/posts/default?alt=json-in-script&amp;max-results=1&amp;callback=renderLatestHagigey"></script>
</body>
</html>\n`;
}

function articlePage(post, previous, next) {
  const description = excerpt(post.text, 155);
  const keywords = post.labels.slice(0, 8).join(", ");
  const url = `${SITE}/blog/posts/${post.id}.html`;
  const articleJson = {
    "@context": "https://schema.org", "@type": "Article", headline: post.title,
    description, datePublished: post.published, dateModified: post.published, inLanguage: "he",
    mainEntityOfPage: url, author: { "@type": "Person", name: "אורי פוגלר", url: `${SITE}/about.html` },
    publisher: { "@type": "Person", name: "אורי פוגלר", url: `${SITE}/about.html` },
  };
  const related = [previous, next].filter(Boolean).map((item) => `<a href="${item.id}.html"><span>${escapeHtml(hebrewDate(item.date))}</span><strong>${escapeHtml(item.title)}</strong></a>`).join("");
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#173d39" />
  <title>${escapeHtml(post.title)} | הגיגי אמרי</title>
  <meta name="description" content="${escapeHtml(description)}" />
  ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}" />` : ""}
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="he_IL" />
  <meta property="og:title" content="${escapeHtml(post.title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="article:published_time" content="${escapeHtml(post.published)}" />
  <link rel="icon" href="../../favicon.svg" type="image/svg+xml" />
  ${adSenseCode()}
  <link rel="stylesheet" href="../article.css" />
  <script type="application/ld+json">${JSON.stringify(articleJson).replaceAll("<", "\\u003c")}</script>
</head>
<body>
  <a class="skip-link" href="#article">דילוג למאמר</a>
  <header class="article-header"><div class="shell">${topNav("../../")}</div></header>
  <main id="article" class="article-wrap">
    <nav class="breadcrumbs" aria-label="פירורי לחם"><a href="../">הגיגי אמרי</a><span aria-hidden="true">/</span><span>${escapeHtml(post.title)}</span></nav>
    <article class="article-content">
      <header><time datetime="${escapeHtml(post.published)}">${escapeHtml(hebrewDate(post.date))}</time><h1>${escapeHtml(post.title)}</h1><p class="byline">מאת <a href="../../about.html">אורי פוגלר</a></p></header>
      <div class="prose">${post.blocks.join("\n        ")}</div>
    </article>
    ${related ? `<nav class="related" aria-label="מאמרים נוספים"><p class="eyebrow">המשך קריאה</p>${related}</nav>` : ""}
    <p class="back-link"><a href="../archive.html">לארכיון המלא ←</a></p>
  </main>
  ${footer("../../")}
</body>
</html>\n`;
}

function archivePage(posts) {
  const years = new Map();
  for (const post of posts) {
    const year = post.date.getFullYear();
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(post);
  }
  const groups = [...years].map(([year, entries]) => `<section class="archive-year"><h2>${year}</h2><ol>${entries.map((post) => `<li><time datetime="${escapeHtml(post.published)}">${escapeHtml(hebrewDate(post.date))}</time><a href="posts/${post.id}.html">${escapeHtml(post.title)}</a></li>`).join("")}</ol></section>`).join("\n");
  return `<!doctype html>
<html lang="he" dir="rtl"><head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ארכיון מאמרים | הגיגי אמרי</title>
  <meta name="description" content="ארכיון מלא של ${posts.length} מאמרים מקוריים מאת אורי פוגלר, מסודרים לפי שנת פרסום." />
  <link rel="canonical" href="${SITE}/blog/archive.html" /><link rel="icon" href="../favicon.svg" type="image/svg+xml" /><link rel="stylesheet" href="article.css" />
</head><body><a class="skip-link" href="#archive">דילוג לארכיון</a>
  <header class="article-header"><div class="shell">${topNav("../")}</div></header>
  <main id="archive" class="archive-wrap"><p class="eyebrow">הגיגי אמרי</p><h1>ארכיון המאמרים</h1><p class="archive-intro">${posts.length} מאמרים מקוריים בפרשת השבוע, תלמוד והלכה.</p>${groups}</main>
  ${footer("../")}</body></html>\n`;
}

const articleCss = `@import url("https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700&family=Frank+Ruhl+Libre:wght@500;600;700&display=swap");
:root{color-scheme:light;--green:#173d39;--green-2:#24534d;--ink:#202724;--text:#46504b;--muted:#707a74;--paper:#fffefb;--canvas:#f7f3eb;--gold:#c99542;--line:rgba(23,61,57,.16);--serif:"Frank Ruhl Libre",serif;--sans:"Assistant",Arial,sans-serif}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-width:320px;color:var(--ink);background:var(--canvas);font-family:var(--sans);line-height:1.7;-webkit-font-smoothing:antialiased}a{color:inherit;text-underline-offset:4px}.shell{width:min(1080px,calc(100% - 40px));margin-inline:auto}.skip-link{position:fixed;z-index:20;inset:8px 8px auto auto;padding:10px 14px;color:#fff;background:var(--green);transform:translateY(-160%)}.skip-link:focus{transform:none}.site-nav{display:flex;align-items:center;gap:22px;padding-block:18px;font-weight:700}.site-nav a{text-decoration:none}.site-nav a:hover,.site-nav a[aria-current=page]{color:#f2d19a}.masthead{min-height:330px;color:#fff;background:linear-gradient(135deg,#102c29,#24534d)}.brand{margin:54px 0 0;font-family:var(--serif);font-size:clamp(3.8rem,10vw,7rem);font-weight:600;letter-spacing:-.05em;line-height:.9}.tagline{margin:20px 0 0;color:#d8e2df;font-size:1.2rem}.blog-main{padding-block:clamp(42px,7vw,80px)}.lead{padding:clamp(30px,6vw,64px);border:1px solid var(--line);background:var(--paper)}.eyebrow{margin:0 0 10px;color:var(--gold);font-size:.78rem;font-weight:700;letter-spacing:.08em}.lead h1,.archive-wrap h1{max-width:840px;margin:0;font-family:var(--serif);font-size:clamp(2.8rem,7vw,5rem);font-weight:600;letter-spacing:-.04em;line-height:1.05}.lead h1 a{text-decoration:none}.lead-copy{max-width:760px;margin:22px 0;color:var(--text);font-family:var(--serif);font-size:1.16rem;line-height:1.9}.primary-link,.read-more{color:var(--green);font-weight:700}.recent{padding-block:clamp(56px,8vw,92px)}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:25px}.section-heading h2,.books-callout h2{margin:0;font-family:var(--serif);font-size:2.35rem}.section-heading>a{font-weight:700}.post-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.post-card{display:flex;min-height:330px;flex-direction:column;padding:28px;border:1px solid var(--line);background:var(--paper)}.post-card time,.article-content time,.archive-year time{color:var(--muted);font-size:.86rem}.post-card h2{margin:14px 0 0;font-family:var(--serif);font-size:1.7rem;line-height:1.15}.post-card h2 a{text-decoration:none}.post-card p{color:var(--text)}.post-card .read-more{margin-top:auto}.books-callout{display:flex;align-items:center;justify-content:space-between;gap:40px;padding:38px 42px;color:#fff;background:var(--green)}.books-callout p:not(.eyebrow){max-width:650px;margin:8px 0 0;color:#dce5e2}.books-callout .primary-link{flex:none;color:#fff}.article-header{color:#fff;background:var(--green)}.article-wrap{width:min(820px,calc(100% - 40px));margin-inline:auto;padding-block:32px 80px}.breadcrumbs{display:flex;gap:9px;overflow:hidden;margin-bottom:48px;color:var(--muted);font-size:.9rem;white-space:nowrap}.breadcrumbs span:last-child{overflow:hidden;text-overflow:ellipsis}.article-content{padding:clamp(28px,7vw,72px);border:1px solid var(--line);background:var(--paper)}.article-content header{padding-bottom:35px;border-bottom:1px solid var(--line)}.article-content h1{margin:10px 0 12px;font-family:var(--serif);font-size:clamp(2.8rem,8vw,4.8rem);font-weight:600;letter-spacing:-.04em;line-height:1.05}.byline{margin:0;color:var(--muted)}.prose{padding-top:42px;font-family:var(--serif);font-size:1.2rem;line-height:2}.prose p,.prose blockquote{margin:0 0 1.45em}.prose h2{margin:2em 0 .65em;font-size:1.65rem}.prose blockquote{padding-inline-start:24px;border-inline-start:3px solid var(--gold);color:var(--text)}.related{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding-top:45px}.related .eyebrow{grid-column:1/-1}.related>a{display:block;padding:20px;border:1px solid var(--line);background:var(--paper);text-decoration:none}.related span,.related strong{display:block}.related span{color:var(--muted);font-size:.8rem}.related strong{margin-top:5px;font-family:var(--serif);font-size:1.2rem}.back-link{margin-top:32px;font-weight:700}.archive-wrap{width:min(900px,calc(100% - 40px));margin-inline:auto;padding-block:70px}.archive-intro{margin:16px 0 60px;color:var(--text);font-size:1.1rem}.archive-year{display:grid;grid-template-columns:100px 1fr;padding-block:30px;border-top:1px solid var(--line)}.archive-year h2{margin:0;color:var(--green);font-size:1.45rem}.archive-year ol{margin:0;padding:0;list-style:none}.archive-year li{display:grid;grid-template-columns:160px 1fr;gap:20px;padding:9px 0}.archive-year a{font-family:var(--serif);font-size:1.08rem;font-weight:600}footer{padding:34px 0;color:var(--muted);border-top:1px solid var(--line);background:var(--paper)}.footer-inner{display:flex;flex-wrap:wrap;gap:12px 24px}.footer-inner span{margin-inline-end:auto}@media(max-width:800px){.post-grid{grid-template-columns:1fr 1fr}.books-callout{align-items:flex-start;flex-direction:column}.article-content{padding:30px}.archive-year{grid-template-columns:1fr}.archive-year h2{margin-bottom:12px}}@media(max-width:560px){.site-nav{gap:15px;font-size:.9rem}.masthead{min-height:280px}.post-grid{grid-template-columns:1fr}.section-heading{align-items:flex-start;flex-direction:column}.post-card{min-height:0}.article-wrap{width:min(100% - 24px,820px)}.article-content{padding:25px 20px}.prose{font-size:1.1rem}.related{grid-template-columns:1fr}.archive-year li{grid-template-columns:1fr;gap:0}.footer-inner span{width:100%}}@media print{.article-header,.breadcrumbs,.related,.back-link,footer{display:none}.article-wrap{width:100%;padding:0}.article-content{border:0;padding:0}.prose{font-size:12pt}}`;

async function loadFeed() {
  if (inputFile) return JSON.parse(await readFile(resolve(inputFile), "utf8"));
  const entries = [];
  for (let start = 1; start <= 451; start += 50) {
    const url = `https://hagigey.blogspot.com/feeds/posts/default?alt=json&max-results=50&start-index=${start}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Blogger returned ${response.status} for ${url}`);
    const data = await response.json();
    entries.push(...(data.feed?.entry ?? []));
  }

  // Blogger's legacy feed occasionally skips imported posts when paginated.
  // Compare it with Blogger's own sitemap and recover any skipped post IDs.
  const knownUrls = new Set(entries.flatMap((entry) => entry.link ?? [])
    .filter((link) => link.rel === "alternate")
    .map((link) => link.href));
  const sitemapResponse = await fetch("https://hagigey.blogspot.com/sitemap.xml");
  if (!sitemapResponse.ok) throw new Error(`Blogger sitemap returned ${sitemapResponse.status}`);
  const sitemap = await sitemapResponse.text();
  const sitemapUrls = [...sitemap.matchAll(/<loc>(https:\/\/hagigey\.blogspot\.com\/[^<]+)<\/loc>/g)].map((match) => match[1]);
  const missingUrls = sitemapUrls.filter((url) => !knownUrls.has(url));

  for (let offset = 0; offset < missingUrls.length; offset += 8) {
    const pageEntries = await Promise.all(missingUrls.slice(offset, offset + 8).map(async (url) => {
      const pageResponse = await fetch(url);
      if (!pageResponse.ok) throw new Error(`Blogger returned ${pageResponse.status} for ${url}`);
      const page = await pageResponse.text();
      const postId = page.match(/postId':\s*'(\d+)'/)?.[1];
      if (!postId) throw new Error(`Could not find a post ID for ${url}`);
      const feedResponse = await fetch(`https://hagigey.blogspot.com/feeds/posts/default/${postId}?alt=json`);
      if (!feedResponse.ok) throw new Error(`Blogger feed returned ${feedResponse.status} for post ${postId}`);
      return (await feedResponse.json()).entry;
    }));
    entries.push(...pageEntries);
  }
  return { feed: { entry: entries } };
}

const data = await loadFeed();
const unique = new Map();
for (const entry of data.feed?.entry ?? []) {
  const post = postFromEntry(entry);
  if (post && post.blocks.length && !unique.has(post.id)) unique.set(post.id, post);
}
const posts = [...unique.values()].sort((a, b) => b.date - a.date);
if (!posts.length) throw new Error("No usable Blogger posts were found.");

await mkdir(POSTS_DIR, { recursive: true });
await writeFile(join(ROOT, "blog", "article.css"), articleCss);
await writeFile(join(ROOT, "blog", "index.html"), blogIndex(posts));
await writeFile(join(ROOT, "blog", "archive.html"), archivePage(posts));
for (let index = 0; index < posts.length; index += 1) {
  await writeFile(join(POSTS_DIR, `${posts[index].id}.html`), articlePage(posts[index], posts[index - 1], posts[index + 1]));
}

const sitemapPages = [
  ["/", posts[0].published], ["/blog/", posts[0].published], ["/blog/archive.html", posts[0].published],
  ["/books.html", "2026-09-10"], ["/about.html", "2026-09-10"], ["/privacy.html", "2026-09-10"],
  ...posts.map((post) => [`/blog/posts/${post.id}.html`, post.published]),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPages.map(([path, modified]) => `  <url><loc>${SITE}${path}</loc><lastmod>${String(modified).slice(0, 10)}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(join(ROOT, "sitemap.xml"), sitemap);
console.log(`Generated ${posts.length} static articles, the blog index, archive, and sitemap.`);
