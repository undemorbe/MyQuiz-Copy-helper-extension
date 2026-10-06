(function () {
  "use strict";

  // Текущая вёрстка play.myquiz.ru собрана на CSS-модулях: классы вида
  // "simpleQuestion-module__title__RO0N9". Хэш в конце меняется при пересборке
  // сайта, поэтому ищем по стабильной части имени класса.
  const QUESTION_ROOT_SELECTOR = "[class*='gameScreen-module__leftSideBlock']";
  const QUESTION_TEXT_SELECTORS = [
    "[class*='Question-module__title__']",
    "#questionDetails__Text",
  ];
  // Подсказка к открытому вопросу ("Пояснение: Форма ответа – ...").
  const QUESTION_NOTE_SELECTOR = "[class*='Question-module__answerNoteContainer__']";

  // Блок варианта ответа у каждого типа вопроса свой модуль:
  // simpleQuestion-module__answer__, answerItem-module__answer__ (голосование,
  // порядок строк), imageAnswerItem-module__answer__ (картинки),
  // barDiagram-module__answer__ (экран после ответа) и т.д.
  const OPTION_ITEM_SELECTORS = [
    "[class*='-module__answer__']",
    "#questionDetails__Answers .answerButton",
    "#questionDetails__Answers [class*='answerButton']",
    "#questionDetails__Answers [class*='answerOption']",
  ];

  const OPTION_TEXT_SELECTORS = [
    "[class*='-module__answerTextValue__']",
    "[class*='-module__answerText__']",
    ".answerButton__TextSpan",
    ".answerOptions__Text",
  ];

  // На диаграмме результатов тексты вариантов лежат отдельным списком.
  const DETACHED_TEXT_SELECTOR = "[class*='-module__answerTextValue__']";
  const OPTION_IMAGE_SELECTOR = "[class*='-module__answerImg__']";
  const RANGE_MARK_SELECTOR = ".myquiz-slider-mark-text";

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function getRoot() {
    return $(QUESTION_ROOT_SELECTOR) || document;
  }

  function extractQuestionText() {
    const root = getRoot();
    let text = "";
    for (const sel of QUESTION_TEXT_SELECTORS) {
      const el = $(sel, root);
      if (el && el.innerText.trim()) {
        text = el.innerText.trim();
        break;
      }
    }
    const note = $(QUESTION_NOTE_SELECTOR, root);
    if (text && note && note.innerText.trim()) {
      text += "\n" + note.innerText.trim().replace(/\s*\n\s*/g, " ");
    }
    return text;
  }

  // Только внешние совпадения: вложенные элементы того же селектора не нужны.
  function outermost(nodes) {
    return nodes.filter((n) => !nodes.some((other) => other !== n && other.contains(n)));
  }

  function textOf(el) {
    return el ? el.innerText.trim().replace(/\s*\n\s*/g, " ") : "";
  }

  function findOptionText(item) {
    for (const sel of OPTION_TEXT_SELECTORS) {
      const text = textOf(item.querySelector(sel));
      if (text) return text;
    }
    return "";
  }

  function extractOptions() {
    const root = getRoot();

    let items = [];
    for (const sel of OPTION_ITEM_SELECTORS) {
      const nodes = outermost($$(sel, root));
      if (nodes.length) {
        items = nodes;
        break;
      }
    }

    let texts = items.map(findOptionText);

    if (items.length && texts.every((t) => !t)) {
      const detached = $$(DETACHED_TEXT_SELECTOR, root).map(textOf);
      if (detached.length === items.length) texts = detached;
    }

    texts = texts.map((text, i) => {
      if (text) return text;
      return items[i].querySelector(OPTION_IMAGE_SELECTOR) ? "[изображение]" : "";
    });

    const options = texts.filter(Boolean).map((text) => ({ text }));
    if (options.length) return options;

    // Вопрос-диапазон: вариантов нет, есть шкала слайдера.
    const marks = $$(RANGE_MARK_SELECTOR, root).map(textOf).filter(Boolean);
    if (marks.length >= 2) {
      return [{ text: `Диапазон: ${marks[0]} – ${marks[marks.length - 1]}`, plain: true }];
    }
    return [];
  }

  function copyToClipboard() {
    const questionText = extractQuestionText();
    const options = extractOptions();

    if (!questionText && options.length === 0) {
      console.log("[MyQuiz] Не удалось найти вопрос или варианты ответов");
      return;
    }

    const optionsText = options
      .map((opt, idx) => (opt.plain ? opt.text : `${String.fromCharCode(65 + idx)}. ${opt.text}`))
      .join("\n");
    const text = [questionText, optionsText].filter(Boolean).join("\n\n");

    writeClipboard(text).then(() => {
      console.log("[MyQuiz] Скопировано в буфер обмена:", text);
      showNotification("Скопировано в буфер обмена");
    }).catch((err) => {
      console.error("[MyQuiz] Ошибка копирования:", err);
      showNotification("Ошибка копирования", true);
    });
  }

  // Chrome отклоняет navigator.clipboard без фокуса/жеста пользователя
  // (например, при вызове через commands API), поэтому есть запасной путь.
  function writeClipboard(text) {
    if (navigator.clipboard && document.hasFocus()) {
      return navigator.clipboard.writeText(text).catch(() => execCommandCopy(text));
    }
    return execCommandCopy(text);
  }

  function execCommandCopy(text) {
    return new Promise((resolve, reject) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
      document.body.appendChild(textarea);
      const prevFocus = document.activeElement;
      textarea.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      textarea.remove();
      if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus();
      ok ? resolve() : reject(new Error("execCommand('copy') failed"));
    });
  }

  // Защита от двойного срабатывания (keydown + команда расширения).
  let lastCopyAt = 0;
  function triggerCopy() {
    const now = Date.now();
    if (now - lastCopyAt < 500) return;
    lastCopyAt = now;
    copyToClipboard();
  }

  function showNotification(message, isError = false) {
    const notification = document.createElement("div");
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isError ? "#f38ba8" : "#a6e3a1"};
      color: #1e1e2e;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease-out;
    `;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transition = "opacity 0.3s ease-out";
      notification.style.opacity = "0";
      setTimeout(() => {
        notification.remove();
        style.remove();
      }, 300);
    }, 2000);
  }

  // e.code не зависит от раскладки (на русской e.key будет "В").
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyD") {
      e.preventDefault();
      triggerCopy();
    }
  });

  const api = typeof browser !== "undefined" ? browser : chrome;
  api.runtime.onMessage.addListener((message) => {
    if (message && message.type === "myquiz-copy") triggerCopy();
  });

  console.log("[MyQuiz] Content script загружен. Нажмите Ctrl+Shift+D для копирования вопроса.");
})();
