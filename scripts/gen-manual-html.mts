// Builds a standalone documentation website for the user manual into
// docs/manual/ (index.html + screens/), from the SAME source of truth the
// in-app manual uses (app/(backend)/manual/manual-content.ts). Meant to be
// published with GitHub Pages (Settings ▸ Pages ▸ Source: /docs on main →
// served at https://<owner>.github.io/<repo>/manual/).
//
// Run: npm run manual:html   (regenerate after editing manual-content.ts
// or re-running `npm run manual:screens`).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile, readdir, copyFile, rm } from "node:fs/promises";
import {
  MANUAL_AUDIENCES,
  AUDIENCE_LABEL,
  AUDIENCE_BLURB,
  topicsForAudience,
  type ManualBlock,
  type ManualTopic,
} from "../app/(backend)/manual/manual-content";

const rootDir = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const srcScreens = path.join(rootDir, "public/manual/screens");
const outDir = path.join(rootDir, "docs/manual");
const outScreens = path.join(outDir, "screens");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const topicId = (t: ManualTopic) => `${t.audience}-${t.slug}`;

const NOTE_META = {
  tip: { label: "Tip", cls: "note--tip" },
  info: { label: "Note", cls: "note--info" },
  warning: { label: "Important", cls: "note--warning" },
} as const;

function renderBlock(block: ManualBlock): string {
  switch (block.type) {
    case "p":
      return `<p>${esc(block.text)}</p>`;
    case "steps":
      return `<ol>${block.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`;
    case "bullets":
      return `<ul>${block.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "note": {
      const m = NOTE_META[block.variant];
      return `<div class="note ${m.cls}"><span class="note__label">${m.label}</span><span>${esc(block.text)}</span></div>`;
    }
    case "shot": {
      // manual-content stores src as "/manual/screens/NAME.png"; here the
      // page lives at docs/manual/index.html so screens/ is relative.
      const file = block.src.replace(/^\/manual\//, "");
      return `<figure><img src="${esc(file)}" alt="${esc(block.caption)}" loading="lazy" /><figcaption>${esc(block.caption)}</figcaption></figure>`;
    }
    default:
      return "";
  }
}

function renderTopic(topic: ManualTopic): string {
  const sections = topic.sections
    .map(
      (s) => `
        <div class="subsection">
          <h4>${esc(s.heading)}</h4>
          ${s.blocks.map(renderBlock).join("\n          ")}
        </div>`
    )
    .join("");
  return `
      <section class="topic" id="${topicId(topic)}">
        <h3>${esc(topic.title)}</h3>
        <p class="topic__summary">${esc(topic.summary)}</p>
        ${sections}
        <a class="topic__top" href="#top">↑ Back to top</a>
      </section>`;
}

function renderTocGroup(audience: (typeof MANUAL_AUDIENCES)[number]): string {
  const topics = topicsForAudience(audience);
  return `
      <div class="toc__group">
        <p class="toc__heading">${esc(AUDIENCE_LABEL[audience])}</p>
        <ul>
          ${topics
            .map((t) => `<li><a href="#${topicId(t)}">${esc(t.title)}</a></li>`)
            .join("\n          ")}
        </ul>
      </div>`;
}

function renderAudienceBlock(audience: (typeof MANUAL_AUDIENCES)[number]): string {
  const topics = topicsForAudience(audience);
  return `
    <h2 class="audience" id="aud-${audience}">${esc(AUDIENCE_LABEL[audience])}</h2>
    <p class="audience__blurb">${esc(AUDIENCE_BLURB[audience])}</p>
    ${topics.map(renderTopic).join("\n")}`;
}

const CSS = `
:root{
  --bg:#ffffff; --surface:#f7f8fa; --text:#1f2328; --muted:#59636e;
  --border:#d1d9e0; --accent:#2f6feb; --accent-weak:#ddeaff;
  --tip:#1a7f37; --tip-bg:#eaf6ec; --info:#2f6feb; --info-bg:#e8f0fe;
  --warn:#9a6700; --warn-bg:#fff5e0;
  --sidebar-w:288px; --header-h:56px; --content-max:820px;
}
@media (prefers-color-scheme:dark){
  :root{
    --bg:#0d1117; --surface:#161b22; --text:#e6edf3; --muted:#9198a1;
    --border:#30363d; --accent:#4c8dff; --accent-weak:#17324f;
    --tip:#3fb950; --tip-bg:#12261a; --info:#4c8dff; --info-bg:#12233b;
    --warn:#d29922; --warn-bg:#2b2412;
  }
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0; background:var(--bg); color:var(--text);
  font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Source Sans 3",Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
a{color:var(--accent); text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%}

.site-header{
  position:sticky; top:0; z-index:20; height:var(--header-h);
  display:flex; align-items:center; gap:12px; padding:0 18px;
  background:var(--bg); border-bottom:1px solid var(--border);
}
.site-header h1{font-size:16px; margin:0; font-weight:650}
.site-header .sub{color:var(--muted); font-size:13px; margin-left:2px}
.menu-btn{
  display:none; border:1px solid var(--border); background:var(--surface);
  color:var(--text); border-radius:8px; padding:6px 10px; font-size:14px; cursor:pointer;
}

.layout{display:grid; grid-template-columns:var(--sidebar-w) 1fr; align-items:start}

.toc{
  position:sticky; top:var(--header-h); align-self:start;
  height:calc(100vh - var(--header-h)); overflow-y:auto;
  padding:22px 14px 60px; border-right:1px solid var(--border); background:var(--bg);
}
.toc__group{margin-bottom:20px}
.toc__heading{
  margin:0 0 6px; padding:0 8px; font-size:11px; font-weight:700;
  letter-spacing:.06em; text-transform:uppercase; color:var(--muted);
}
.toc ul{list-style:none; margin:0; padding:0}
.toc li{margin:1px 0}
.toc a{
  display:block; padding:5px 8px; border-radius:6px; font-size:13.5px;
  color:var(--text); border-left:2px solid transparent;
}
.toc a:hover{background:var(--surface); text-decoration:none}
.toc a.active{
  background:var(--accent-weak); border-left-color:var(--accent);
  color:var(--accent); font-weight:600;
}

.content{
  max-width:var(--content-max); padding:34px 40px 120px; margin:0 auto; width:100%;
}
.intro h2:first-child{margin-top:0}
.lead{color:var(--muted); font-size:17px}

.audience{
  margin:56px 0 4px; padding-bottom:8px; font-size:24px;
  border-bottom:2px solid var(--border);
}
.audience:first-of-type{margin-top:8px}
.audience__blurb{color:var(--muted); margin:6px 0 8px}

.topic{scroll-margin-top:calc(var(--header-h) + 16px); padding:22px 0 8px; border-bottom:1px solid var(--border)}
.topic h3{font-size:20px; margin:14px 0 2px}
.topic__summary{color:var(--muted); margin:0 0 14px}
.subsection{margin:18px 0}
.subsection h4{font-size:15.5px; margin:0 0 8px; color:var(--text)}
.topic ol,.topic ul{padding-left:22px; margin:10px 0}
.topic li{margin:4px 0}
.topic__top{display:inline-block; margin-top:10px; font-size:13px; color:var(--muted)}

.note{
  display:flex; gap:10px; align-items:flex-start;
  margin:14px 0; padding:12px 14px; border-radius:8px;
  border:1px solid var(--border); border-left-width:4px; background:var(--surface);
  font-size:14.5px;
}
.note__label{font-weight:700; flex:none}
.note--tip{border-left-color:var(--tip); background:var(--tip-bg)}
.note--tip .note__label{color:var(--tip)}
.note--info{border-left-color:var(--info); background:var(--info-bg)}
.note--info .note__label{color:var(--info)}
.note--warning{border-left-color:var(--warn); background:var(--warn-bg)}
.note--warning .note__label{color:var(--warn)}

figure{margin:18px 0}
figure img{
  display:block; width:100%; border:1px solid var(--border);
  border-radius:10px; box-shadow:0 1px 3px rgba(0,0,0,.08);
}
figcaption{margin-top:8px; font-size:13px; color:var(--muted)}

.scrim{display:none}

@media (max-width:900px){
  :root{--content-max:100%}
  .menu-btn{display:inline-block}
  .layout{grid-template-columns:1fr}
  .toc{
    position:fixed; top:var(--header-h); left:0; width:min(320px,86vw);
    height:calc(100vh - var(--header-h)); transform:translateX(-102%);
    transition:transform .2s ease; z-index:30;
  }
  .toc.open{transform:none}
  .scrim.show{display:block; position:fixed; inset:var(--header-h) 0 0 0; background:rgba(0,0,0,.4); z-index:25}
  .content{padding:24px 20px 100px}
}
`;

function buildHtml(): string {
  const toc = MANUAL_AUDIENCES.map(renderTocGroup).join("");
  const body = MANUAL_AUDIENCES.map(renderAudienceBlock).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>Helpdesk — User Manual</title>
<style>${CSS}</style>
</head>
<body>
<a id="top"></a>
<header class="site-header">
  <button class="menu-btn" id="menuBtn" aria-label="Toggle contents">☰ Contents</button>
  <h1>Helpdesk <span class="sub">User Manual</span></h1>
</header>
<div class="scrim" id="scrim"></div>
<div class="layout">
  <nav class="toc" id="toc" aria-label="Contents">
    <div class="toc__group">
      <p class="toc__heading">Overview</p>
      <ul><li><a href="#top">Introduction</a></li></ul>
    </div>
    ${toc}
  </nav>
  <main class="content">
    <div class="intro">
      <h2 style="margin-top:0">Helpdesk User Manual</h2>
      <p class="lead">
        How to use the Helpdesk system, organised by role. Requesters raise and follow
        tickets; approvers sign off on requests that need it; administrators triage
        tickets and manage the master data. Use the contents on the left to jump to a topic.
      </p>
    </div>
    ${body}
  </main>
</div>
<script>
(function(){
  var menuBtn=document.getElementById('menuBtn');
  var toc=document.getElementById('toc');
  var scrim=document.getElementById('scrim');
  function closeNav(){toc.classList.remove('open');scrim.classList.remove('show');}
  menuBtn.addEventListener('click',function(){
    toc.classList.toggle('open');scrim.classList.toggle('show');
  });
  scrim.addEventListener('click',closeNav);
  toc.addEventListener('click',function(e){if(e.target.tagName==='A')closeNav();});

  // Scrollspy: highlight the current topic in the contents.
  var links={};
  toc.querySelectorAll('a[href^="#"]').forEach(function(a){
    links[a.getAttribute('href').slice(1)]=a;
  });
  var current=null;
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){
        if(current)current.classList.remove('active');
        var a=links[en.target.id];
        if(a){a.classList.add('active');current=a;
          a.scrollIntoView({block:'nearest'});}
      }
    });
  },{rootMargin:'-60px 0px -70% 0px',threshold:0});
  document.querySelectorAll('section.topic').forEach(function(s){obs.observe(s);});
})();
</script>
</body>
</html>
`;
}

async function run() {
  await rm(outScreens, { recursive: true, force: true });
  await mkdir(outScreens, { recursive: true });

  const shots = (await readdir(srcScreens)).filter((f) => f.endsWith(".png"));
  for (const f of shots) {
    await copyFile(path.join(srcScreens, f), path.join(outScreens, f));
  }
  // GitHub Pages runs Jekyll on /docs by default; harmless here, but be explicit.
  await writeFile(path.join(rootDir, "docs/.nojekyll"), "");
  await writeFile(path.join(outDir, "index.html"), buildHtml(), "utf8");

  console.log(`gen-manual-html: docs/manual/index.html + ${shots.length} screenshot(s)`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
