// This file contains functions for applying filters to the displayed data, allowing users to filter by type, status, and search terms.

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
  
  document.querySelectorAll('.file-item').forEach(item => {
    const isVisible = 
      (filterValues.type === 'all' || item.dataset.type === filterValues.type) &&
      (filterValues.status === 'all' || item.dataset.status === filterValues.status) &&
      (filterValues.fileType === 'all' || item.dataset.filetype === filterValues.fileType) &&
      (!filterValues.search || item.dataset.name.includes(filterValues.search));
    
    item.style.display = isVisible ? 'flex' : 'none';
  });
  
  document.querySelectorAll('.folder').forEach(folder => {
    const folderId = folder.id.replace('folder-', '');
    const contentDiv = document.getElementById(`content-${folderId}`);
    
    if (contentDiv) {
      const hasVisibleItems = contentDiv.querySelectorAll('.file-item[style="display: flex;"]').length > 0;
      folder.style.display = hasVisibleItems ? 'block' : 'none';
    }
  });
}