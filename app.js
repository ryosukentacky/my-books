const library = document.getElementById('library');
const reader = document.getElementById('reader');
const bookCards = [...document.querySelectorAll('.book-card')];
const backBtn = document.getElementById('backBtn');
const searchBtn = document.getElementById('searchBtn');
const searchPanel = document.getElementById('searchPanel');
const searchInput = document.getElementById('searchInput');
const searchCount = document.getElementById('searchCount');
const chat = document.getElementById('chat');
const progressBar = document.getElementById('progressBar');
const topBtn = document.getElementById('topBtn');
const readerTitle = document.getElementById('readerTitle');
const readerSubtitle = document.getElementById('readerSubtitle');

let sourceText = '';
let messageData = [];
const cache = new Map();

function showScreen(name) {
  library.classList.toggle('active', name === 'library');
  reader.classList.toggle('active', name === 'reader');
  window.scrollTo(0, 0);
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\\\*\\\*/g, '**');
}

function isLikelyUserLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^(次|つぎ|お願い|お願いします|続き|続きを)$/u.test(t)) return true;
  if (/^(第.+?(解説して|解説してほしい|も.+?解説して|を.+?解説して)|.+?を解説して)$/u.test(t)) return true;
  if (/^(この.+?(形式|形).+?(解説|説明)|同じ.+?(形式|形).+?(解説|説明))/u.test(t)) return true;
  return false;
}

function parseConversation(text) {
  const lines = normalize(text).split('\n');
  const parts = [];
  let current = [];

  const flushAssistant = () => {
    const content = current.join('\n').trim();
    if (content) parts.push({ role: 'assistant', content });
    current = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^(Thoughts|Analyzing .+|Deconstructing .+)$/i.test(line)) continue;

    if (isLikelyUserLine(line)) {
      flushAssistant();
      parts.push({ role: 'user', content: line });
      continue;
    }
    current.push(rawLine);
  }
  flushAssistant();
  return parts;
}

function safeMarkdown(md) {
  if (window.marked && window.DOMPurify) {
    marked.setOptions({ breaks: true, gfm: true });
    return DOMPurify.sanitize(marked.parse(md));
  }
  const div = document.createElement('div');
  div.textContent = md;
  return div.innerHTML.replace(/\n/g, '<br>');
}

function renderMessages(query = '') {
  const q = query.trim().toLowerCase();
  let matches = 0;
  chat.innerHTML = '';

  messageData.forEach((msg) => {
    const row = document.createElement('section');
    row.className = `message ${msg.role}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (!q) {
      bubble.innerHTML = msg.role === 'assistant'
        ? safeMarkdown(msg.content)
        : safeMarkdown(`**${msg.content}**`);
    } else {
      const plain = msg.content;
      const lower = plain.toLowerCase();
      const count = lower.split(q).length - 1;
      matches += count;

      if (count > 0) {
        const escaped = plain.replace(/[&<>"']/g, s => ({
          '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
        }[s]));
        const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        bubble.innerHTML = escaped
          .replace(new RegExp(`(${escapedQ})`, 'gi'), '<mark>$1</mark>')
          .replace(/\n/g, '<br>');
      } else {
        bubble.innerHTML = msg.role === 'assistant'
          ? safeMarkdown(msg.content)
          : safeMarkdown(`**${msg.content}**`);
      }
    }

    row.appendChild(bubble);
    chat.appendChild(row);
  });

  searchCount.textContent = q ? `${matches}件見つかりました` : '';
}

async function loadBook(card) {
  const file = card.dataset.file;
  const key = card.dataset.book;

  readerTitle.textContent = card.dataset.title || '';
  readerSubtitle.textContent = card.dataset.subtitle || '';
  searchInput.value = '';
  searchCount.textContent = '';
  searchPanel.hidden = true;
  progressBar.style.width = '0%';
  chat.innerHTML = '<div class="loading">本を開いています…</div>';

  if (cache.has(key)) {
    const cached = cache.get(key);
    sourceText = cached.sourceText;
    messageData = cached.messageData;
    renderMessages();
    return;
  }

  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error('load failed');
    sourceText = await res.text();
    messageData = parseConversation(sourceText);
    cache.set(key, { sourceText, messageData });
    renderMessages();
  } catch (e) {
    chat.innerHTML = '<div class="loading">本文を読み込めませんでした。GitHub Pages上で開いてください。</div>';
  }
}

bookCards.forEach((card) => {
  card.addEventListener('click', async () => {
    showScreen('reader');
    await loadBook(card);
  });
});

backBtn.addEventListener('click', () => showScreen('library'));
searchBtn.addEventListener('click', () => {
  searchPanel.hidden = !searchPanel.hidden;
  if (!searchPanel.hidden) searchInput.focus();
});
searchInput.addEventListener('input', () => renderMessages(searchInput.value));
topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

window.addEventListener('scroll', () => {
  if (!reader.classList.contains('active')) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  topBtn.classList.toggle('show', window.scrollY > 700);
});
