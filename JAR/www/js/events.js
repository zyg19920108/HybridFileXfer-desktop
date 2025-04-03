// File: /my-transfer-app/my-transfer-app/js/events.js

function setupEventListeners() {
  const DOM = {
    tabs: document.querySelectorAll('.tab'),
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

  DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.tabs.forEach(t => t.classList.remove('active'));
      DOM.tabContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
      
      if (tab.dataset.tab === 'history') loadHistory();
    });
  });
  
  DOM.filters.type.addEventListener('change', applyFilters);
  DOM.filters.status.addEventListener('change', applyFilters);
  DOM.filters.fileType.addEventListener('change', applyFilters);
  DOM.filters.search.addEventListener('input', applyFilters);
  
  DOM.filters.historyType.addEventListener('change', loadHistory);
  DOM.filters.historyStatus.addEventListener('change', loadHistory);
  DOM.filters.historyFileType.addEventListener('change', loadHistory);
  DOM.filters.historySearch.addEventListener('input', loadHistory);
  DOM.filters.date.addEventListener('change', loadHistory);
  
  DOM.clearHistoryBtn.addEventListener('click', deleteSelectedFiles);
  
  document.getElementById('select-all').addEventListener('click', toggleSelectAll);
  
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('folder-checkbox')) {
      const folderPath = e.target.dataset.path;
      const folderId = encodeFolderId(folderPath);
      const folderElement = document.getElementById(`history-folder-${folderId}`);
      
      folderElement.classList.add('expanded');
      
      const fileCheckboxes = folderElement.querySelectorAll('.file-checkbox');
      fileCheckboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
      });
    }
  });
}