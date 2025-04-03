// filepath: /my-transfer-app/my-transfer-app/js/dom.js

const DOM = {
  foldersContainer: document.getElementById('folders-container'),
  historyFoldersContainer: document.getElementById('history-folders-container'),
  lastUpdated: document.getElementById('last-updated'),
  tabs: document.querySelectorAll('.tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  clearHistoryBtn: document.getElementById('clear-history'),
  filters: {
    type: document.getElementById('type-filter'),
    status: document.getElementById('status-filter'),
    fileType: document.getElementById('filetype-filter'),
    search: document.getElementById('search-filter'),
    historyType: document.getElementById('history-type-filter'),
    historyStatus: document.getElementById('history-status-filter'),
    historyFileType: document.getElementById('history-filetype-filter'),
    historySearch: document.getElementById('history-search-filter'),
    date: document.getElementById('date-filter')
  }
};