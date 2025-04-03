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
  // 修改 setupEventListeners 函数中的 clearHistory 按钮事件
  DOM.clearHistoryBtn.addEventListener('click', deleteSelectedFiles);
  
  // 全选/取消全选按钮事件
  document.getElementById('select-all').addEventListener('click', toggleSelectAll);
  
  // 文件夹复选框点击事件
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('folder-checkbox')) {
      const folderPath = e.target.dataset.path;
      const folderId = encodeFolderId(folderPath);
      const folderElement = document.getElementById(`history-folder-${folderId}`);
      
      // 确保文件夹是展开状态
      folderElement.classList.add('expanded');
      
      // 选中/取消选中该文件夹下所有文件
      const fileCheckboxes = folderElement.querySelectorAll('.file-checkbox');
      fileCheckboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
      });
    }
  });
}

// 添加全选/取消全选功能
function toggleSelectAll() {
  const selectAllBtn = document.getElementById('select-all');
  const isSelectAll = selectAllBtn.textContent === '全选';
  
  // 切换所有复选框状态
  const allCheckboxes = document.querySelectorAll('.folder-checkbox, .file-checkbox');
  allCheckboxes.forEach(checkbox => {
    checkbox.checked = isSelectAll;
  });
  
  // 展开所有文件夹
  document.querySelectorAll('.folder').forEach(folder => {
    folder.classList.add('expanded');
  });
  
  // 切换按钮文本
  selectAllBtn.textContent = isSelectAll ? '取消全选' : '全选';
}

/**
 * 删除选中的文件和文件夹
 */
async function deleteSelectedFiles() {
  if (!db) return;
  
  // 获取所有选中的文件路径
  const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
    .map(checkbox => checkbox.dataset.path);
  
  // 获取所有选中的文件夹路径
  const selectedFolders = Array.from(document.querySelectorAll('.folder-checkbox:checked'))
    .map(checkbox => checkbox.dataset.path);
  
  if (selectedFiles.length === 0 && selectedFolders.length === 0) {
    alert('请先选择要删除的文件或文件夹');
    return;
  }

  if (!confirm(`确定要删除选中的 ${selectedFiles.length} 个文件和 ${selectedFolders.length} 个文件夹吗？此操作不可恢复！`)) {
    return;
  }

  try {
    // 调用 aardio 删除文件（如果可用）
    try {
      if (aardio?.deletefile) {
        const pathsToDelete = [...selectedFiles, ...selectedFolders];
        const result = aardio.deletefile(pathsToDelete);
        if (!result) {
          console.warn('aardio.deletefile 返回失败，继续删除数据库记录');
        }
      }
    } catch (error) {
      console.warn('aardio.deletefile 调用失败:', error);
    }

    // 从数据库删除记录
    await deleteRecordsFromDB(selectedFiles, selectedFolders);
    
    // 重新加载历史记录
    loadHistory();
    
    // 重置全选按钮状态
    document.getElementById('select-all').textContent = '全选';
    
    console.log('删除操作完成');
  } catch (error) {
    console.error('删除文件失败:', error);
    alert('删除文件失败！');
  }
}

/**
 * 从数据库删除选中的记录
 * @param {Array} filePaths - 文件路径数组
 * @param {Array} folderPaths - 文件夹路径数组
 */
function deleteRecordsFromDB(filePaths, folderPaths) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIG.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(CONFIG.STORE_NAME);
    
    // 删除选中的文件 - 改为直接使用主键查询
    filePaths.forEach(path => {
      const fileName = path.split('/').pop();
      const request = store.openCursor();
      
      request.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.fileName === fileName) {
            store.delete(cursor.primaryKey);
          }
          cursor.continue();
        }
      };
    });
    
    // 删除选中的文件夹下的所有文件
    folderPaths.forEach(folderPath => {
      const request = store.openCursor();
      
      request.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.folderPath === folderPath) {
            store.delete(cursor.primaryKey);
          }
          cursor.continue();
        }
      };
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

