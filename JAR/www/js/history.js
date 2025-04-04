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
    size: file.currentSize,  // 确保这里已经是byte单位
    status: 'completed',
    startTime: now.getTime() - Math.round(file.currentSize * 10),
    endTime: now.getTime(),
    fileType: fileExt,
    fileTypeCategory: getFileTypeCategory(fileExt),
    progress: 100,
    currentSize: file.currentSize  // 确保这里已经是byte单位
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
  Object.entries(folders).forEach(([folderPath, files]) => {
    const folderElement = createHistoryFolderElement(folderPath, files);
    DOM.historyFoldersContainer.appendChild(folderElement);
    
    // 移除默认展开第一个文件夹的逻辑
    // 所有文件夹初始状态为折叠
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
  
  // 在文件夹头部添加安卓打开按钮
  if (files[0]?.type === 'download') {
      const openBtn = document.createElement('button');
      openBtn.className = 'open-folder-btn';
      openBtn.textContent = '打开文件夹';
      openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          aardio?.openpath?.(folderPath);
      });
      folderHeader.appendChild(openBtn);
  } else if (files[0]?.type === 'upload') {
      const openAdbBtn = document.createElement('button');
      openAdbBtn.className = 'open-folder-btn';
      openAdbBtn.textContent = '打开安卓文件夹';
      openAdbBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // 使用adb命令打开安卓文件夹
          const adbCommand = `am start -a android.intent.action.VIEW -t resource/folder -d file://${folderPath}`;
          aardio?.adbcmd?.(adbCommand);
      });
      folderHeader.appendChild(openAdbBtn);
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
    
    // 构建文件项HTML
    let fileItemHTML = `
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
    `;
    
    // 只在download类型时添加打开按钮
    if (file.type === 'download') {
        fileItemHTML += `<button class="open-folder-btn" onclick="aardio?.openpath?.('${file.path}')">打开文件</button>`;
    } else if (file.type === 'upload') {
        fileItemHTML += `<button class="open-folder-btn" onclick="openAndroidFile('${file.path}')">打开安卓文件</button>`;
    }
    
    fileItemHTML += `</div>`;
    fileItem.innerHTML = fileItemHTML;
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

// 添加新函数
function openAndroidFile(filePath) {
    // 获取文件扩展名
    const fileExt = filePath.split('.').pop().toLowerCase();
    // 获取对应的MIME类型
    const mimeType = getMimeType(fileExt);
    
    // 构建ADB命令
    const adbCommand = `am start -a android.intent.action.VIEW -t ${mimeType} -d file://${filePath}`;
    
    // 调用aardio执行ADB命令
    aardio?.adbcmd?.(adbCommand);
}

// 辅助函数：根据文件扩展名获取MIME类型
function getMimeType(ext) {
    const mimeTypes = {
        // 图片类型
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        
        // 视频类型
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        'flv': 'video/x-flv',
        'wmv': 'video/x-ms-wmv',
        'webm': 'video/webm',
        
        // 音频类型
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
        'aac': 'audio/aac',
        'm4a': 'audio/mp4',
        
        // 文档类型
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'rtf': 'application/rtf',
        'csv': 'text/csv',
        'xml': 'application/xml',
        'json': 'application/json',
        
        // Office文档
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'odt': 'application/vnd.oasis.opendocument.text',
        'ods': 'application/vnd.oasis.opendocument.spreadsheet',
        
        // 压缩文件
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
        
        // 编程相关
        'html': 'text/html',
        'htm': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'php': 'application/x-httpd-php',
        'py': 'text/x-python',
        'java': 'text/x-java-source',
        'c': 'text/x-csrc',
        'cpp': 'text/x-c++src',
        'h': 'text/x-chdr',
        'sh': 'application/x-sh',
        'bat': 'application/x-msdownload',
        
        // 其他常见类型
        'apk': 'application/vnd.android.package-archive',
        'exe': 'application/x-msdownload',
        'dmg': 'application/x-apple-diskimage',
        'iso': 'application/x-iso9660-image',
        'msi': 'application/x-msdownload'
    };
    return mimeTypes[ext] || 'application/octet-stream'; // 默认使用二进制流类型
}
