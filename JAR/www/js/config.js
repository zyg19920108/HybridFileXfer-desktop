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
  HISTORY_SAVE_INTERVAL: 3000 // 历史记录保存间隔(ms)
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
let speedInterval = null;//速度
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