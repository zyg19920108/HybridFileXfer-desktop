/**
 * 文件传输监控系统 - 主逻辑脚本
 * 功能：监控文件传输状态，管理历史记录，提供筛选和查看功能
 */

// ==================== 配置常量 ====================
const CONFIG = {
  API_URL: 'http://localhost:5741/transfers',
  DB_NAME: 'FileTransferHistoryDB',
  DB_VERSION: 1,
  STORE_NAME: 'transfers',
  REFRESH_INTERVAL: 1000, // 数据刷新间隔(ms)
  HISTORY_SAVE_INTERVAL: 1000 // 历史记录保存间隔(ms)
};

// 文件类型分类映射表
const FILE_TYPES = {
  archive: ['zip', 'rar', '7z', 'tar', 'gz'],
  executable: ['exe', 'msi', 'bat', 'cmd', 'sh'],
  apk: ['apk'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'aac'],
  iso: ['iso', 'img', 'bin'],
  text: ['txt', 'log', 'ini', 'conf', 'json', 'xml', 'html', 'css', 'js']
};

// 文件类型图标映射
const FILE_ICONS = {
  archive: '🗜️',
  executable: '⚙️',
  apk: '📱',
  document: '📝',
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  iso: '💿',
  text: '📄',
  default: '📄'
};

// ==================== 全局变量 ====================
let db = null; // IndexedDB 实例
let currentData = null; // 当前传输数据
let refreshInterval = null; // 数据刷新定时器
let historySaveInterval = null; // 历史记录保存定时器

// ==================== DOM 元素缓存 ====================
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

// ==================== 工具函数 ====================

/**
 * 格式化文件大小 (输入为KB)
 * @param {number} kilobytes - 文件大小(KB)
 * @returns {string} 格式化后的文件大小字符串
 */
function formatFileSize(kilobytes) {
  if (kilobytes === 0) return '0 KB';
  
  const k = 1024;
  const sizes = ['KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(kilobytes) / Math.log(k));
  
  return parseFloat((kilobytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 编码文件夹路径为有效的HTML ID
 * @param {string} path - 文件夹路径
 * @returns {string} 编码后的ID
 */
function encodeFolderId(path) {
  return path.replace(/[\/\.]/g, '-').replace(/[^\w-]/g, '');
}

/**
 * 获取文件类型分类
 * @param {string} fileExt - 文件扩展名
 * @returns {string} 文件类型分类
 */
function getFileTypeCategory(fileExt) {
  for (const [category, exts] of Object.entries(FILE_TYPES)) {
    if (exts.includes(fileExt)) return category;
  }
  return 'other';
}

/**
 * 获取文件类型图标
 * @param {string} fileExt - 文件扩展名
 * @returns {string} 对应的图标
 */
function getFileIcon(fileExt) {
  const category = getFileTypeCategory(fileExt);
  return FILE_ICONS[category] || FILE_ICONS.default;
}

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
    DOM.foldersContainer.innerHTML = '<div class="empty-folder">没有正在进行的文件传输</div>';
    return;
  }

  DOM.foldersContainer.innerHTML = '';
  
  data.transfers.forEach(transfer => {
    const { folder: folderPath, files } = transfer;
    const folderId = encodeFolderId(folderPath);
    
    // 创建或获取文件夹元素
    let folderElement = document.getElementById(`folder-${folderId}`) || createFolderElement(folderPath, files);
    
    // 更新文件夹内容
    updateFolderContent(folderElement, folderPath, files);
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
 */
function updateFolderContent(folderElement, folderPath, files) {
  const folderId = encodeFolderId(folderPath);
  const contentDiv = document.getElementById(`content-${folderId}`) || 
                     folderElement.querySelector('.folder-content');
  
  contentDiv.innerHTML = files.length ? '' : '<div class="empty-folder">此文件夹为空</div>';
  
  files.forEach(file => {
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
    
    contentDiv.appendChild(fileItem);
  });
}

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
  if (!db) return;
  
  try {
    const historyData = await getAllHistoryRecords();
    const filteredData = filterHistoryData(historyData);
    
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
  contentDiv.id = `history-content-${folderId}`;
  
  // 添加文件项
  files.forEach(file => {
    const fileExt = file.fileName.split('.').pop().toLowerCase();
    const fileIcon = getFileIcon(fileExt);
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
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
        <span class="file-status status-completed">已完成</span>
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

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  // 初始化数据库
  initDB()
    .then(() => {
      console.log('数据库初始化完成');
      // 设置事件监听
      setupEventListeners();
      // 初始获取数据
      fetchData();
      // 设置定时器
      setupRefreshInterval();
      setupHistorySaveInterval();
    })
    .catch(error => console.error('数据库初始化失败:', error));
});

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  // 标签切换
  DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.tabs.forEach(t => t.classList.remove('active'));
      DOM.tabContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
      
      if (tab.dataset.tab === 'history') loadHistory();
    });
  });
  
  // 筛选器事件
  DOM.filters.type.addEventListener('change', applyFilters);
  DOM.filters.status.addEventListener('change', applyFilters);
  DOM.filters.fileType.addEventListener('change', applyFilters);
  DOM.filters.search.addEventListener('input', applyFilters);
  
  // 历史记录筛选器事件
  DOM.filters.historyType.addEventListener('change', loadHistory);
  DOM.filters.historyStatus.addEventListener('change', loadHistory);
  DOM.filters.historyFileType.addEventListener('change', loadHistory);
  DOM.filters.historySearch.addEventListener('input', loadHistory);
  DOM.filters.date.addEventListener('change', loadHistory);
  
  // 清空历史记录按钮
  DOM.clearHistoryBtn.addEventListener('click', clearHistory);
}