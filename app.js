const library = document.getElementById("library");
const reader = document.getElementById("reader");

const bookCards = document.querySelectorAll(".book-card");

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

let currentMessages = [];


/* =========================
   画面切り替え
========================= */

function showLibrary() {
  library.classList.add("active");
  reader.classList.remove("active");

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });
}


function showReader() {
  library.classList.remove("active");
  reader.classList.add("active");

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });
}


/* =========================
   HTMLの安全化
========================= */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================
   Markdown表示
========================= */

function markdownToHtml(text) {

  // marked が読み込めている場合
  if (typeof marked !== "undefined") {

    try {

      return marked.parse(text, {
        breaks: true,
        gfm: true
      });

    } catch (error) {

      console.error("Markdown変換エラー", error);

    }

  }


  // marked が使えない場合でも本文を表示
  return escapeHtml(text).replace(/\n/g, "<br>");

}


/* =========================
   ユーザー発言か判定
========================= */

function isUserMessage(text) {

  const t = text.trim();

  if (!t) {
    return false;
  }


  // 「次」「つぎ」
  if (
    t === "次" ||
    t === "つぎ" ||
    t === "お願い" ||
    t === "お願いします" ||
    t === "続き" ||
    t === "続きを"
  ) {
    return true;
  }


  // 「○○を解説して」
  if (
    t.endsWith("解説して") ||
    t.endsWith("説明して")
  ) {
    return true;
  }


  return false;
}


/* =========================
   チャット内容を分割
========================= */

function parseConversation(text) {

  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n");


  const messages = [];

  let assistantLines = [];


  function flushAssistant() {

    const content = assistantLines
      .join("\n")
      .trim();


    if (content) {

      messages.push({
        role: "assistant",
        content: content
      });

    }


    assistantLines = [];

  }


  for (const rawLine of lines) {

    const line = rawLine.trim();


    // ChatGPT内部表示のような不要行を除外
    if (
      line === "Thoughts" ||
      line.startsWith("Analyzing ") ||
      line.startsWith("Deconstructing ")
    ) {
      continue;
    }


    // ユーザー発言
    if (isUserMessage(line)) {

      flushAssistant();

      messages.push({
        role: "user",
        content: line
      });

      continue;
    }


    assistantLines.push(rawLine);

  }


  flushAssistant();


  return messages;

}


/* =========================
   チャット表示
========================= */

function renderMessages(messages) {

  chat.innerHTML = "";


  messages.forEach((message) => {

    const row = document.createElement("section");

    row.className =
      "message " + message.role;


    const bubble =
      document.createElement("div");

    bubble.className = "bubble";


    if (message.role === "user") {

      bubble.innerHTML =
        markdownToHtml(
          "**" + message.content + "**"
        );

    } else {

      bubble.innerHTML =
        markdownToHtml(
          message.content
        );

    }


    row.appendChild(bubble);

    chat.appendChild(row);

  });

}


/* =========================
   本を読み込む
========================= */

async function openBook(card) {

  const file =
    card.dataset.file;


  const title =
    card.dataset.title;


  const subtitle =
    card.dataset.subtitle;


  readerTitle.textContent =
    title || "";


  readerSubtitle.textContent =
    subtitle || "";


  chat.innerHTML =
    '<div class="loading">本を開いています…</div>';


  showReader();


  try {

    console.log(
      "読み込みファイル:",
      file
    );


    const response =
      await fetch(
        "./" + file + "?v=" + Date.now()
      );


    console.log(
      "HTTP status:",
      response.status
    );


    if (!response.ok) {

      throw new Error(
        "HTTP error " +
        response.status
      );

    }


    const text =
      await response.text();


    console.log(
      "本文文字数:",
      text.length
    );


    currentMessages =
      parseConversation(text);


    renderMessages(
      currentMessages
    );


  } catch (error) {

    console.error(
      "本文読み込みエラー:",
      error
    );


    chat.innerHTML = `
      <div class="loading">

        <p>
          本文を読み込めませんでした。
        </p>

        <p style="font-size:14px;margin-top:12px;">
          読み込み対象：
          <strong>${file}</strong>
        </p>

        <p style="font-size:13px;margin-top:8px;">
          ${escapeHtml(error.message)}
        </p>

      </div>
    `;

  }

}


/* =========================
   本をクリック
========================= */

bookCards.forEach((card) => {

  card.addEventListener(
    "click",
    function () {

      openBook(card);

    }
  );

});


/* =========================
   戻る
========================= */

backBtn.addEventListener(
  "click",
  showLibrary
);


/* =========================
   検索
========================= */

searchBtn.addEventListener(
  "click",
  function () {

    searchPanel.hidden =
      !searchPanel.hidden;


    if (!searchPanel.hidden) {

      searchInput.focus();

    }

  }
);


searchInput.addEventListener(
  "input",
  function () {

    const keyword =
      searchInput.value
        .trim()
        .toLowerCase();


    if (!keyword) {

      renderMessages(
        currentMessages
      );

      searchCount.textContent =
        "";

      return;

    }


    let count = 0;


    const filtered =
      currentMessages.filter(
        (message) => {

          const hit =
            message.content
              .toLowerCase()
              .includes(keyword);


          if (hit) {
            count++;
          }


          return hit;

        }
      );


    renderMessages(filtered);


    searchCount.textContent =
      count +
      "件見つかりました";

  }
);


/* =========================
   一番上へ戻る
========================= */

topBtn.addEventListener(
  "click",
  function () {

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }
);


/* =========================
   読書進捗
========================= */

window.addEventListener(
  "scroll",
  function () {

    if (
      !reader.classList.contains(
        "active"
      )
    ) {
      return;
    }


    const documentHeight =
      document.documentElement
        .scrollHeight -
      window.innerHeight;


    let progress = 0;


    if (documentHeight > 0) {

      progress =
        (
          window.scrollY /
          documentHeight
        ) * 100;

    }


    progressBar.style.width =
      progress + "%";


    if (window.scrollY > 700) {

      topBtn.classList.add(
        "show"
      );

    } else {

      topBtn.classList.remove(
        "show"
      );

    }

  }
);
