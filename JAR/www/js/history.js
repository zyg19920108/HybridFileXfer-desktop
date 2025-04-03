// ==================== 历史记录功能 ====================

/**
 * 保存已完成的历史记录到IndexedDB
 */
function saveCompletedTransfers() {
  if (!currentData?.transfers || !db) return;
  
  const transaction = db.transaction([CONFIG.STORE_NAME], 'readwrite');
  const store = transaction.objectStore(CONFIG.STORE_NAME);
  
  currentData.transfers.forEach(transfer => {
    transfer.files.forEach(file => {
      if (file.progress === 100) {
        const fileName = file.path.split('/').pop();
        const fileExt = fileName.split('.').pop().toLowerCase();
        
        store.index('fileName').get(fileName).onsuccess = e => {
          if (!e.target.result) {
            const record = createHistoryRecord(file, transfer.folder, fileName, fileExt);
            store.add(record).onsuccess = () => console.log('历史记录已保存:', fileName);
          }
        };
      }
    });
  });
}

/**
 * 创建历史记录对象
 * @param {Object} file - 文件对象
 * @param {string} folderPath - 文件夹路径
 * @param {string} fileName - 文件名
 * @param {string} fileExt - 文件扩展名
 * @returns {Object} 历史记录对象
 */
function createHistoryRecord(file, folderPath, fileName, fileExt) {
  const now = new Date();
  return {
    fileName,
    path: file.path,
    folderPath,
    type: file.type,
    size: file.currentSize,
    status: 'completed',
    startTime: now.getTime() - Math.round(file.currentSize * 10),
    endTime: now.getTime(),
    fileType: fileExt,
    fileTypeCategory: getFileTypeCategory(fileExt),
    progress: 100,
    currentSize: file.currentSize
  };
}

/**
 * 加载并渲染历史记录
 */
async function loadHistory() {
  if (!db) {
    console.error('数据库未初始化');
    return;
  }
  
  try {
    const historyData = await getAllHistoryRecords();
    console.log('原始历史数据:', historyData); // 调试
    
    const filteredData = filterHistoryData(historyData);
    console.log('筛选后历史数据:', filteredData); // 调试
    
    renderHistory(filteredData);
  } catch (error) {
    console.error('加载历史记录失败:', error);
    DOM.historyFoldersContainer.innerHTML = '<div class="empty-folder">加载历史记录失败</div>';
  }
}

/**
 * 从数据库获取所有历史记录
 * @returns {Promise<Array>} 历史记录数组
 */
function getAllHistoryRecords() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIG.STORE_NAME], 'readonly');
    const store = transaction.objectStore(CONFIG.STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 筛选历史记录数据
 * @param {Array} historyData - 原始历史数据
 * @returns {Array} 筛选后的历史数据
 */
function filterHistoryData(historyData) {
  const {
    historyType: typeFilter,
    historyStatus: statusFilter,
    historyFileType: fileTypeFilter,
    historySearch: searchFilter,
    date: dateFilter
  } = DOM.filters;
  
  let filtered = [...historyData];
  
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(item => item.type === typeFilter.value);
  }
  
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(item => item.status === statusFilter.value);
  }
  
  if (fileTypeFilter.value !== 'all') {
    filtered = filtered.filter(item => item.fileTypeCategory === fileTypeFilter.value);
  }
  
  if (searchFilter.value) {
    const search = searchFilter.value.toLowerCase();
    filtered = filtered.filter(item => item.fileName.toLowerCase().includes(search));
  }
  
  if (dateFilter.value) {
    const filterDate = new Date(dateFilter.value);
    filtered = filtered.filter(item => {
      return new Date(item.endTime).toDateString() === filterDate.toDateString();
    });
  }
  
  return filtered.sort((a, b) => b.endTime - a.endTime);
}

/**
 * 渲染历史记录
 * @param {Array} historyData - 历史记录数据
 */
function renderHistory(historyData) {
  DOM.historyFoldersContainer.innerHTML = '';
  
  if (!historyData?.length) {
    DOM.historyFoldersContainer.innerHTML = '<div class="empty-folder">没有历史记录</div>';
    return;
  }
  
  // 按文件夹分组
  const folders = historyData.reduce((groups, item) => {
    (groups[item.folderPath] = groups[item.folderPath] || []).push(item);
    return groups;
  }, {});
  
  // 渲染每个文件夹
  Object.entries(folders).forEach(([folderPath, files], index) => {
    const folderElement = createHistoryFolderElement(folderPath, files);
    DOM.historyFoldersContainer.appendChild(folderElement);
    
    // 默认展开第一个文件夹
    if (index === 0) folderElement.classList.add('expanded');
  });
}

/**
 * 创建历史记录文件夹元素
 * @param {string} folderPath - 文件夹路径
 * @param {Array} files - 文件列表
 * @returns {HTMLElement} 文件夹元素
 */
function createHistoryFolderElement(folderPath, files) {
  const folderId = encodeFolderId(folderPath);
  const folderElement = document.createElement('div');
  folderElement.className = 'folder';
  folderElement.id = `history-folder-${folderId}`;
  
  // 文件夹头部
  const folderHeader = document.createElement('div');
  folderHeader.className = 'folder-header';
  
  // 添加复选框
  const folderCheckbox = document.createElement('div');
  folderCheckbox.className = 'checkbox-container';
  folderCheckbox.innerHTML = `
    <input type="checkbox" class="folder-checkbox" data-path="${folderPath}">
  `;
  folderHeader.appendChild(folderCheckbox);
  
  // 添加文件夹图标和名称
  folderHeader.innerHTML += `<span class="folder-icon">📁</span>`;
  
  // 添加完整路径
  const folderPathSpan = document.createElement('span');
  folderPathSpan.className = 'folder-path';
  folderPathSpan.textContent = folderPath;
  folderHeader.appendChild(folderPathSpan);
  
  // 如果是下载类型，添加打开按钮
  if (files[0]?.type === 'download') {
    const openBtn = document.createElement('button');
    openBtn.className = 'open-folder-btn';
    openBtn.textContent = '打开文件夹';
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      aardio?.openpath?.(folderPath);
    });
    folderHeader.appendChild(openBtn);
  }
  
  // 添加文件计数
  const countSpan = document.createElement('span');
  countSpan.className = 'folder-count';
  countSpan.textContent = `${files.length} 项`;
  folderHeader.appendChild(countSpan);
  
  // 点击事件
  folderHeader.addEventListener('click', () => folderElement.classList.toggle('expanded'));
  
  // 文件夹内容区域
  const contentDiv = document.createElement('div');
  contentDiv.className = 'folder-content';
  contentDiv.id = `history-content-${folderId}`;
  
  // 添加文件项
  files.forEach(file => {
    const fileExt = file.fileName.split('.').pop().toLowerCase();
    const fileIcon = getFileIcon(fileExt);
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <div class="checkbox-container">
        <input type="checkbox" class="file-checkbox" data-path="${file.path}">
      </div>
      <span class="file-icon">${fileIcon}</span>
      <div class="file-info">
        <div class="file-name" title="${file.fileName}">${file.fileName}</div>
        <div class="file-progress">
          <div class="file-progress-bar progress-${file.type}" style="width: 100%"></div>
        </div>
      </div>
      <div class="file-details">
        <span class="file-size">${formatFileSize(file.size)}</span>
        <span class="file-time">${new Date(file.endTime).toLocaleString()}</span>
        <button class="open-folder-btn" onclick="aardio?.openpath?.('${file.path}')">打开文件</button>
      </div>
    `;
    contentDiv.appendChild(fileItem);
  });
  
  folderElement.append(folderHeader, contentDiv);
  return folderElement;
}

/**
 * 清空历史记录
 */
async function clearHistory() {
  if (!db || !confirm('确定要清空所有历史记录吗？此操作不可恢复！')) return;
  
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFIG.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(CONFIG.STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    console.log('历史记录已清空');
    DOM.historyFoldersContainer.innerHTML = '<div class="empty-folder">没有历史记录</div>';
  } catch (error) {
    console.error('清空历史记录失败:', error);
    alert('清空历史记录失败！');
  }
}

// ==================== 其他功能 ====================

/**
 * 应用筛选条件
 */
function applyFilters() {
  const {
    type: typeFilter,
    status: statusFilter,
    fileType: fileTypeFilter,
    search: searchFilter
  } = DOM.filters;
  
  const filterValues = {
    type: typeFilter.value,
    status: statusFilter.value,
    fileType: fileTypeFilter.value,
    search: searchFilter.value.toLowerCase()
  };
  
  // 筛选文件项
  document.querySelectorAll('.file-item').forEach(item => {
    const isVisible = 
      (filterValues.type === 'all' || item.dataset.type === filterValues.type) &&
      (filterValues.status === 'all' || item.dataset.status === filterValues.status) &&
      (filterValues.fileType === 'all' || item.dataset.filetype === filterValues.fileType) &&
      (!filterValues.search || item.dataset.name.includes(filterValues.search));
    
    item.style.display = isVisible ? 'flex' : 'none';
  });
  
  // 处理空文件夹
  document.querySelectorAll('.folder').forEach(folder => {
    const folderId = folder.id.replace('folder-', '');
    const contentDiv = document.getElementById(`content-${folderId}`);
    
    if (contentDiv) {
      const hasVisibleItems = contentDiv.querySelectorAll('.file-item[style="display: flex;"]').length > 0;
      folder.style.display = hasVisibleItems ? 'block' : 'none';
    }
  });
}

/**
 * 更新最后更新时间显示
 */
function updateLastUpdated() {
  DOM.lastUpdated.textContent = `最后更新: ${new Date().toLocaleTimeString()}`;
}

/**
 * 设置定时刷新
 */
function setupRefreshInterval() {
  clearInterval(refreshInterval);
  refreshInterval = setInterval(fetchData, CONFIG.REFRESH_INTERVAL);
}

/**
 * 设置历史记录保存定时器
 */
function setupHistorySaveInterval() {
  clearInterval(historySaveInterval);
  historySaveInterval = setInterval(saveCompletedTransfers, CONFIG.HISTORY_SAVE_INTERVAL);
}
