// ==================== 核心功能 ====================

/**
 * 初始化IndexedDB数据库
 * @returns {Promise} 返回数据库初始化的Promise
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
    
    request.onerror = (event) => {
      reject(`数据库打开失败: ${event.target.errorCode}`);
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
      setupSpeedInterval();

    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
        const store = db.createObjectStore(CONFIG.STORE_NAME, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        // 创建索引
        store.createIndex('fileName', 'fileName', { unique: false });
        store.createIndex('folderPath', 'folderPath', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('endTime', 'endTime', { unique: false });
        store.createIndex('fileTypeCategory', 'fileTypeCategory', { unique: false });
      }
    };
  });
}
DOM.foldersContainer.innerHTML = '<div class="empty-folder">服务未连接，正在尝试连接...如长时间未连接,请检查APP</div>';
/**
 * 从API获取当前传输数据
 */
async function fetchData() {
  try {
    const response = await fetch(CONFIG.API_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    currentData = await response.json();
    processData(currentData);
    updateLastUpdated();
  } catch (error) {
    console.error('获取数据失败:', error);
  }
}

/**
 * 处理并渲染传输数据
 * @param {Object} data - 传输数据
 */
function processData(data) {
  if (!data?.transfers?.length) {
    DOM.foldersContainer.innerHTML = '<div class="empty-folder">传输状态监控服务已连接</div>';
    return;
  }

  // 保存当前展开状态
  const expandedFolders = new Set();
  document.querySelectorAll('.folder.expanded').forEach(folder => {
    expandedFolders.add(folder.id);
  });

  data.transfers.forEach(transfer => {
    const { folder: folderPath, files } = transfer;
    const folderId = encodeFolderId(folderPath);
    
    // 获取或创建文件夹元素
    let folderElement = document.getElementById(`folder-${folderId}`);
    if (!folderElement) {
      folderElement = createFolderElement(folderPath, files);
    }
    
    // 更新文件夹内容（增量更新）
    updateFolderContent(folderElement, folderPath, files, true); // 新增参数表示增量更新
    
    // 恢复展开状态
    if (expandedFolders.has(folderElement.id)) {
      folderElement.classList.add('expanded');
    }
  });

  applyFilters();
}

/**
 * 创建文件夹元素
 * @param {string} folderPath - 文件夹路径
 * @param {Array} files - 文件列表
 * @returns {HTMLElement} 创建的文件夹元素
 */
function createFolderElement(folderPath, files) {
  const folderId = encodeFolderId(folderPath);
  const folderElement = document.createElement('div');
  folderElement.className = 'folder';
  folderElement.id = `folder-${folderId}`;
  
  // 文件夹头部
  const folderHeader = document.createElement('div');
  folderHeader.className = 'folder-header';
  
  // 添加文件夹图标和名称
  folderHeader.innerHTML = `<span class="folder-icon">📁</span>`;
  
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
      aardio?.openpath?.(folderPath) || console.log('模拟打开文件夹:', folderPath);
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
  contentDiv.id = `content-${folderId}`;
  
  folderElement.append(folderHeader, contentDiv);
  DOM.foldersContainer.appendChild(folderElement);
  
  // 默认展开第一个文件夹
  if (DOM.foldersContainer.children.length === 1) {
    folderElement.classList.add('expanded');
  }
  
  return folderElement;
}

/**
 * 更新文件夹内容
 * @param {HTMLElement} folderElement - 文件夹元素
 * @param {string} folderPath - 文件夹路径
 * @param {Array} files - 文件列表
 * @param {boolean} incremental - 是否增量更新
 */
function updateFolderContent(folderElement, folderPath, files, incremental = false) {
  const folderId = encodeFolderId(folderPath);
  const contentDiv = document.getElementById(`content-${folderId}`) || 
                     folderElement.querySelector('.folder-content');
  
  // 如果不是增量更新，清空内容
  if (!incremental) {
    contentDiv.innerHTML = files.length ? '' : '<div class="empty-folder">此文件夹为空</div>';
  }

  // 创建文件项映射，用于增量更新
  const existingItems = {};
  if (incremental) {
    contentDiv.querySelectorAll('.file-item').forEach(item => {
      const fileName = item.querySelector('.file-name').textContent;
      existingItems[fileName] = item;
    });
  }

  files.forEach(file => {
    const fileName = file.path.split('/').pop();
    
    // 如果是增量更新且文件已存在，则更新现有元素
    if (incremental && existingItems[fileName]) {
      const fileItem = existingItems[fileName];
      updateFileItem(fileItem, file);
      return;
    }
    
    // 否则创建新文件项
    const fileItem = createFileItem(file);
    contentDiv.appendChild(fileItem);
  });
}

/**
 * 创建文件项元素
 */
function createFileItem(file) {
  const fileName = file.path.split('/').pop();
  const fileExt = fileName.split('.').pop().toLowerCase();
  const fileType = getFileTypeCategory(fileExt);
  const fileIcon = getFileIcon(fileExt);
  
  // 确定状态
  let statusText, statusClass;
  if (file.progress === 100) {
    statusText = '已完成';
    statusClass = 'completed';
  } else if (file.progress > 0) {
    statusText = file.type === 'upload' ? '上传中...' : '下载中...';
    statusClass = file.type === 'upload' ? 'uploading' : 'downloading';
  } else {
    statusText = '等待中';
    statusClass = 'queued';
  }
  
  // 创建文件项
  const fileItem = document.createElement('div');
  fileItem.className = 'file-item';
  fileItem.dataset.type = file.type;
  fileItem.dataset.status = file.progress === 100 ? 'completed' : 
                          file.progress > 0 ? 'in-progress' : 'queued';
  fileItem.dataset.name = fileName.toLowerCase();
  fileItem.dataset.filetype = fileType;
  
  const currentSizeKB = file.currentSize || 0;
  const totalSizeKB = file.totalSize || currentSizeKB;
  
  fileItem.innerHTML = `
    <span class="file-icon">${fileIcon}</span>
    <div class="file-info">
      <div class="file-name" title="${fileName}">${fileName}</div>
      <div class="file-progress">
        <div class="file-progress-bar progress-${file.type}" 
             style="width: ${file.progress.toFixed(2)}%"></div>
      </div>
    </div>
    <div class="file-details">
      <span class="file-size">
        ${formatFileSize(currentSizeKB)} / ${formatFileSize(totalSizeKB)}
      </span>
      <span class="file-status status-${statusClass}">
        ${statusText} (${file.progress.toFixed(2)}%)
      </span>
    </div>
  `;
  
  return fileItem;
}

/**
 * 更新现有文件项
 */
function updateFileItem(fileItem, file) {
  const fileName = file.path.split('/').pop();
  const currentProgress = parseFloat(fileItem.querySelector('.file-progress-bar').style.width);
  const currentStatus = fileItem.querySelector('.file-status').textContent.split(' ')[0];
  
  // 获取当前显示的文件大小
  const currentSizeText = fileItem.querySelector('.file-size').textContent;
  const [currentSizeDisplay, totalSizeDisplay] = currentSizeText.split(' / ');
  
  // 计算新文件大小
  const currentSizeKB = file.currentSize || 0;
  const totalSizeKB = file.totalSize || currentSizeKB;
  const newSizeText = `${formatFileSize(currentSizeKB)} / ${formatFileSize(totalSizeKB)}`;
  
  // 更新进度条
  const progressBar = fileItem.querySelector('.file-progress-bar');
  progressBar.style.width = `${file.progress.toFixed(2)}%`;
  
  // 确定新状态
  let statusText, statusClass;
  if (file.progress === 100) {
    statusText = '已完成';
    statusClass = 'completed';
  } else if (file.progress > 0) {
    statusText = file.type === 'upload' ? '上传中...' : '下载中...';
    statusClass = file.type === 'upload' ? 'uploading' : 'downloading';
  } else {
    statusText = '等待中';
    statusClass = 'queued';
  }
  
  // 检查是否需要更新状态显示（增加文件大小变化的判断）
  if (currentStatus !== statusText.split(' ')[0] || 
      Math.abs(currentProgress - file.progress) > 1 ||
      newSizeText !== currentSizeText) {
    // 更新状态显示
    const statusSpan = fileItem.querySelector('.file-status');
    statusSpan.className = `file-status status-${statusClass}`;
    statusSpan.textContent = `${statusText} (${file.progress.toFixed(2)}%)`;
    
    // 更新文件大小显示
    const sizeSpan = fileItem.querySelector('.file-size');
    sizeSpan.textContent = newSizeText;
    
    // 添加更新动画效果
    fileItem.classList.add('updating');
    setTimeout(() => fileItem.classList.remove('updating'), 300);
  }
}