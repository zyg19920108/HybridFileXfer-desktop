// ==================== 工具函数 ====================

/**
 * 格式化文件大小 (输入为byte)
 * @param {number} bytes - 文件大小(byte)
 * @returns {string} 格式化后的文件大小字符串
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
