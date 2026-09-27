
const library = document.getElementById("library");
const reader = document.getElementById("reader");
const bookCards = [...document.querySelectorAll(".book-card")];
const backBtn = document.getElementById("backBtn");
const searchBtn = document.getElementById("searchBtn");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");
const searchCount = document.getElementById("searchCount");
const chat = document.getElementById("chat");
const progressBar = document.getElementById("progressBar");
const topBtn = document.getElementById("topBtn");
const readerTitle = document.getElementById("readerTitle");
const readerSubtitle = document.getElementById("readerSubtitle");

let messageData = [];
const cache = new Map();

function showScreen(name) {
  library.classList.toggle("active", name === "library");
  reader.classList.toggle("active", name === "reader");
  window.scrollTo({top:0, behavior:"auto"});
}

function normalize(text) {
  return text.replace(/\r\n/g,"\n").replace(/\\\*\\\*/g,"**").replace(/\\_/g,"_");
}

function cleanArtifacts(text) {
  return text
    .replace(/keep_pinメモに保存keep_pin/gi,"")
    .replace(/\b(copy_all|thumb_up|thumb_down|expand_more|more_horiz)\b/gi,"");
}

function isInternal(line) {
  const t = line.trim();
  return t === "Thoughts" ||
    /^(Analyzing|Deconstructing|Defining|Implementing)\b/i.test(t) ||
    /^(keep_pinメモに保存keep_pin|copy_all|thumb_up|thumb_down|expand_more|more_horiz)$/i.test(t);
}

function isUserLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^(次|つぎ|お願い|お願いします|続き|続きを|tugi|tsugi|next)$/iu.test(t)) return true;
  if (t.endsWith("解説して") || t.endsWith("説明して")) return true;
  return false;
}

function parseConversation(text) {
  const lines = normalize(text).split("\n");
  const parts = [];
  let current = [];

  const flush = () => {
    const c = cleanArtifacts(current.join("\n")).trim();
    if (c) parts.push({role:"assistant", content:c});
    current = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (isInternal(line)) continue;
    if (isUserLine(line)) {
      flush();
      parts.push({role:"user", content:line});
    } else {
      current.push(raw);
    }
  }
  flush();
  return parts;
}

function plain(text) {
  return text.replace(/\*\*/g,"").replace(/`/g,"").replace(/\\([_*:#>\-])/g,"$1").trim();
}

function quizFromMessage(text) {
  const result = [];
  const seen = new Set();
  for (const raw of normalize(text).split("\n")) {
    const m = cleanArtifacts(raw).match(/[①②③④⑤]\s*([^→\n]+?)\s*→\s*(.+)$/u);
    if (!m) continue;
    const q = plain(m[1]);
    const a = plain(m[2]);
    const key = q + "||" + a;
    if (q && a && !seen.has(key)) {
      seen.add(key);
      result.push({q,a});
    }
  }
  return result;
}

function safeMarkdown(md) {
  if (window.marked && window.DOMPurify) {
    marked.setOptions({breaks:true,gfm:true});
    return DOMPurify.sanitize(marked.parse(md));
  }
  const d = document.createElement("div");
  d.textContent = md;
  return d.innerHTML.replace(/\n/g,"<br>");
}

function makeQuiz(items) {
  if (!items.length) return null;
  const box = document.createElement("section");
  box.className = "inline-quiz";
  box.innerHTML = `<div class="inline-quiz-title"><strong>確認問題</strong><span>${items.length}問</span></div>
                   <p class="inline-quiz-hint">文章を読み終えたら、答えを思い出してから開いてください。</p>`;

  items.forEach((item,i) => {
    const card = document.createElement("div");
    card.className = "inline-quiz-card";

    const q = document.createElement("p");
    q.className = "inline-quiz-question";
    q.textContent = `Q${i+1}. ${item.q}`;

    const btn = document.createElement("button");
    btn.className = "inline-answer-btn";
    btn.type = "button";
    btn.textContent = "答えを見る";

    const ans = document.createElement("div");
    ans.className = "inline-quiz-answer";
    ans.hidden = true;
    ans.innerHTML = safeMarkdown(item.a);

    btn.onclick = () => {
      ans.hidden = !ans.hidden;
      btn.textContent = ans.hidden ? "答えを見る" : "答えを隠す";
    };

    card.append(q,btn,ans);
    box.appendChild(card);
  });
  return box;
}

function renderMessages(query="") {
  const q = query.trim().toLowerCase();
  let matches = 0;
  chat.innerHTML = "";

  messageData.forEach(msg => {
    const row = document.createElement("section");
    row.className = `message ${msg.role}`;

    const stack = document.createElement("div");
    stack.className = "message-stack";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (!q) {
      bubble.innerHTML = msg.role === "assistant"
        ? safeMarkdown(msg.content)
        : safeMarkdown(`**${msg.content}**`);
    } else {
      const lower = msg.content.toLowerCase();
      matches += lower.split(q).length - 1;
      bubble.innerHTML = safeMarkdown(msg.content);
    }

    stack.appendChild(bubble);

    row.appendChild(stack);
    chat.appendChild(row);
  });

  searchCount.textContent = q ? `${matches}件見つかりました` : "";
}

async function loadBook(card) {
  const key = card.dataset.book;
  const file = card.dataset.file;

  readerTitle.textContent = card.dataset.title || "";
  readerSubtitle.textContent = card.dataset.subtitle || "";
  searchInput.value = "";
  searchCount.textContent = "";
  searchPanel.hidden = true;
  progressBar.style.width = "0%";
  chat.innerHTML = '<div class="loading">本を開いています…</div>';

  if (cache.has(key)) {
    messageData = cache.get(key);
    renderMessages();
    return;
  }

  try {
    const res = await fetch("./"+file+"?v="+Date.now(), {cache:"no-store"});
    if (!res.ok) throw new Error("HTTP "+res.status);
    const text = await res.text();
    messageData = parseConversation(text);
    cache.set(key,messageData);
    renderMessages();
  } catch(e) {
    chat.innerHTML = `<div class="loading">本文を読み込めませんでした。<br><small>${file} / ${e.message}</small></div>`;
  }
}

bookCards.forEach(card => card.addEventListener("click", async () => {
  showScreen("reader");
  await loadBook(card);
}));

backBtn.addEventListener("click", () => showScreen("library"));
searchBtn.addEventListener("click", () => {
  searchPanel.hidden = !searchPanel.hidden;
  if (!searchPanel.hidden) searchInput.focus();
});
searchInput.addEventListener("input", () => renderMessages(searchInput.value));
topBtn.addEventListener("click", () => window.scrollTo({top:0,behavior:"smooth"}));

window.addEventListener("scroll", () => {
  if (!reader.classList.contains("active")) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY/max)*100 : 0;
  progressBar.style.width = `${Math.min(100,Math.max(0,pct))}%`;
  topBtn.classList.toggle("show", window.scrollY > 700);
});
