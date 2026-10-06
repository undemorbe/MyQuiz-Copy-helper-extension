// Пересылает горячую клавишу и клик по иконке в content script активной вкладки.
const api = typeof browser !== "undefined" ? browser : chrome;

function requestCopy(tabId) {
  if (tabId == null) return;
  Promise.resolve(api.tabs.sendMessage(tabId, { type: "myquiz-copy" })).catch(() => {
    // На вкладке нет content script (не myquiz.ru) — игнорируем.
  });
}

api.commands.onCommand.addListener((command, tab) => {
  if (command !== "copy-question") return;
  if (tab && tab.id != null) {
    requestCopy(tab.id);
    return;
  }
  api.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs[0]) requestCopy(tabs[0].id);
  });
});

api.action.onClicked.addListener((tab) => {
  requestCopy(tab.id);
});
