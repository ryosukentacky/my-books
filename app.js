const library = document.getElementById("library");
const reader = document.getElementById("reader");
const bookCards = [...document.querySelectorAll(".book-card")];

const backBtn = document.getElementById("backBtn");
const searchBtn = document.getElementById("searchBtn");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");
const searchCount = document.getElementById("searchCount");

const textTabBtn = document.getElementById("textTabBtn");
const quizTabBtn = document.getElementById("quizTabBtn");
const chat = document.getElementById("chat");
const quiz = document.getElementById("quiz");

const progressBar = document.getElementById("progressBar");
const topBtn = document.getElementById("topBtn");
const readerTitle = document.getElementById("readerTitle");
const readerSubtitle = document.getElementById("readerSubtitle");

let sourceText = "";
let messageData = [];
let quizData = [];
let activeView = "text";
const cache = new Map();

function showScreen(name) {
  library.classList.toggle("active", name === "library");
  reader.classList.toggle("active", name === "reader");
  window.scrollTo({ top: 0, behavior: "auto" });
}

function normalize(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\\\*\\\*/g, "**")
    .replace(/\\_/g, "_");
}

function cleanArtifacts(text) {
  return text
    .replace(/keep_pinメモに保存keep_pin/gi, "")
    .replace(/\bcopy_all\b/gi, "")
    .replace(/\bthumb_up\b/gi, "")
    .replace(/\bthumb_down\b/gi, "")
    .replace(/\bexpand_more\b/gi, "")
    .replace(/\bmore_horiz\b/gi, "");
}

function isInternalLine(line) {
  const t = line.trim();
  return (
    t === "Thoughts" ||
    /^Analyzing\b/i.test(t) ||
    /^Deconstructing\b/i.test(t) ||
    /^Defining\b/i.test(t) ||
    /^Implementing\b/i.test(t) ||
    /^(keep_pinメモに保存keep_pin|copy_all|thumb_up|thumb_down|expand_more|more_horiz)$/i.test(t)
  );
}

function isLikelyUserLine(line) {
  const t = line.trim();
  if (!t) return false;

  if (/^(次|つぎ|つぎ「|お願い|お願いします|続き|続きを|tugi|tsugi|next)$/iu.test(t)) {
    return true;
  }

  if (t.endsWith("解説して") || t.endsWith("説明して")) return true;
  if (/^(この.+?(形式|形).+?(解説|説明)|同じ.+?(形式|形).+?(解説|説明))/u.test(t)) return true;

  return false;
}

function parseConversation(text) {
  const lines = normalize(text).split("\n");
  const parts = [];
  let current = [];

  const flushAssistant = () => {
    const content = cleanArtifacts(current.join("\n")).trim();
    if (content) parts.push({ role: "assistant", content });
    current = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (isInternalLine(line)) continue;

    if (isLikelyUserLine(line)) {
      flushAssistant();
      parts.push({ role: "user", content: line });
      continue;
    }

    current.push(rawLine);
  }

  flushAssistant();
  return parts;
}

function plainMarkdown(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\\([_*:#>\-])/g, "$1")
    .replace(/^\s*[-*]\s*/, "")
    .trim();
}

function buildQuiz(text) {
  const items = [];
  const seen = new Set();
  const lines = normalize(text).split("\n");

  for (const raw of lines) {
    const line = cleanArtifacts(raw);
    const match = line.match(/[①②③④⑤]\s*([^→\n]+?)\s*→\s*(.+)$/u);
    if (!match) continue;

    const question = plainMarkdown(match[1]);
    const answer = plainMarkdown(match[2]);

    if (!question || !answer || answer.length < 2) continue;

    const key = `${question}|||${answer}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({ question, answer });
  }

  return items;
}

function safeMarkdown(md) {
  if (window.marked && window.DOMPurify) {
    marked.setOptions({ breaks: true, gfm: true });
    return DOMPurify.sanitize(marked.parse(md));
  }
  const div = document.createElement("div");
  div.textContent = md;
  return div.innerHTML.replace(/\n/g, "<br>");
}

function renderMessages(query = "") {
  const q = query.trim().toLowerCase();
  let matches = 0;
  chat.innerHTML = "";

  messageData.forEach((msg) => {
    const row = document.createElement("section");
    row.className = `message ${msg.role}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (!q) {
      bubble.innerHTML = msg.role === "assistant"
        ? safeMarkdown(msg.content)
        : safeMarkdown(`**${msg.content}**`);
    } else {
      const plain = msg.content;
      const lower = plain.toLowerCase();
      const count = lower.split(q).length - 1;
      matches += count;

      if (count > 0) {
        const escaped = plain.replace(/[&<>"']/g, s => ({
          "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
        }[s]));
        const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        bubble.innerHTML = escaped
          .replace(new RegExp(`(${escapedQ})`, "gi"), "<mark>$1</mark>")
          .replace(/\n/g, "<br>");
      } else {
        bubble.innerHTML = msg.role === "assistant"
          ? safeMarkdown(msg.content)
          : safeMarkdown(`**${msg.content}**`);
      }
    }

    row.appendChild(bubble);
    chat.appendChild(row);
  });

  searchCount.textContent = q ? `${matches}件見つかりました` : "";
}

function renderQuiz() {
  quiz.innerHTML = "";

  const intro = document.createElement("div");
  intro.className = "quiz-intro";
  intro.innerHTML = `
    <strong>確認問題 ${quizData.length}問</strong>
    <p>まず自分で答えてから「答えを見る」を押してください。</p>
  `;
  quiz.appendChild(intro);

  if (!quizData.length) {
    const empty = document.createElement("div");
    empty.className = "quiz-empty";
    empty.textContent = "この本では自動抽出できる確認問題が見つかりませんでした。";
    quiz.appendChild(empty);
    return;
  }

  quizData.forEach((item, index) => {
    const card = document.createElement("section");
    card.className = "quiz-card";

    const q = document.createElement("h3");
    q.textContent = `Q${index + 1}. ${item.question}`;

    const button = document.createElement("button");
    button.className = "answer-btn";
    button.type = "button";
    button.textContent = "答えを見る";

    const answer = document.createElement("div");
    answer.className = "quiz-answer";
    answer.hidden = true;
    answer.innerHTML = safeMarkdown(item.answer);

    button.addEventListener("click", () => {
      answer.hidden = !answer.hidden;
      button.textContent = answer.hidden ? "答えを見る" : "答えを隠す";
    });

    card.append(q, button, answer);
    quiz.appendChild(card);
  });
}

function setView(view) {
  activeView = view;
  const isText = view === "text";

  textTabBtn.classList.toggle("active", isText);
  quizTabBtn.classList.toggle("active", !isText);
  chat.hidden = !isText;
  quiz.hidden = isText;
  searchBtn.style.visibility = isText ? "visible" : "hidden";
  searchPanel.hidden = true;

  window.scrollTo({ top: 0, behavior: "auto" });
}

async function loadBook(card) {
  const file = card.dataset.file;
  const key = card.dataset.book;

  readerTitle.textContent = card.dataset.title || "";
  readerSubtitle.textContent = card.dataset.subtitle || "";
  searchInput.value = "";
  searchCount.textContent = "";
  progressBar.style.width = "0%";
  setView("text");

  chat.innerHTML = '<div class="loading">本を開いています…</div>';
  quiz.innerHTML = '<div class="loading">確認問題を作成しています…</div>';

  if (cache.has(key)) {
    const cached = cache.get(key);
    sourceText = cached.sourceText;
    messageData = cached.messageData;
    quizData = cached.quizData;
    renderMessages();
    renderQuiz();
    return;
  }

  try {
    const res = await fetch("./" + file + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    sourceText = await res.text();
    messageData = parseConversation(sourceText);
    quizData = buildQuiz(sourceText);

    cache.set(key, { sourceText, messageData, quizData });
    renderMessages();
    renderQuiz();
  } catch (e) {
    chat.innerHTML = `
      <div class="loading">
        本文を読み込めませんでした。<br>
        <small>${file} / ${e.message}</small>
      </div>`;
    quiz.innerHTML = '<div class="loading">確認問題を作成できませんでした。</div>';
  }
}

bookCards.forEach((card) => {
  card.addEventListener("click", async () => {
    showScreen("reader");
    await loadBook(card);
  });
});

backBtn.addEventListener("click", () => showScreen("library"));

textTabBtn.addEventListener("click", () => setView("text"));
quizTabBtn.addEventListener("click", () => setView("quiz"));

searchBtn.addEventListener("click", () => {
  if (activeView !== "text") return;
  searchPanel.hidden = !searchPanel.hidden;
  if (!searchPanel.hidden) searchInput.focus();
});

searchInput.addEventListener("input", () => renderMessages(searchInput.value));

topBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("scroll", () => {
  if (!reader.classList.contains("active")) return;

  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  topBtn.classList.toggle("show", window.scrollY > 700);
});
