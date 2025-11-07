/**
 * Batch Selection Manager - Handles image selection for batch processing
 * Pure vanilla JavaScript, converted from React patterns
 */

class BatchSelection {
  constructor() {
    this.selectedIds = new Set();
    this.allImageIds = [];
    this.onSelectionChange = null; // Callback when selection changes
  }

  /**
   * Initialize with available image IDs
   * @param {Array<string>} imageIds
   */
  setAvailableImages(imageIds) {
    this.allImageIds = imageIds;
    // Remove any selected IDs that no longer exist
    this.selectedIds = new Set(
      [...this.selectedIds].filter(id => imageIds.includes(id))
    );
  }

  /**
   * Toggle selection for a single image
   * @param {string} imageId
   */
  toggleImage(imageId) {
    if (this.selectedIds.has(imageId)) {
      this.selectedIds.delete(imageId);
    } else {
      this.selectedIds.add(imageId);
    }
    this._notifyChange();
  }

  /**
   * Select all images
   */
  selectAll() {
    this.selectedIds = new Set(this.allImageIds);
    this._notifyChange();
  }

  /**
   * Clear all selections
   */
  clearAll() {
    this.selectedIds.clear();
    this._notifyChange();
  }

  /**
   * Select a range of images
   * @param {number} startIndex
   * @param {number} endIndex
   */
  selectRange(startIndex, endIndex) {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    for (let i = start; i <= end && i < this.allImageIds.length; i++) {
      this.selectedIds.add(this.allImageIds[i]);
    }
    this._notifyChange();
  }

  /**
   * Get array of selected image IDs
   * @returns {Array<string>}
   */
  getSelectedIds() {
    return [...this.selectedIds];
  }

  /**
   * Get count of selected images
   * @returns {number}
   */
  getSelectedCount() {
    return this.selectedIds.size;
  }

  /**
   * Check if an image is selected
   * @param {string} imageId
   * @returns {boolean}
   */
  isSelected(imageId) {
    return this.selectedIds.has(imageId);
  }

  /**
   * Check if all images are selected
   * @returns {boolean}
   */
  isAllSelected() {
    return this.allImageIds.length > 0 &&
           this.selectedIds.size === this.allImageIds.length;
  }

  /**
   * Check if some (but not all) images are selected
   * @returns {boolean}
   */
  isSomeSelected() {
    return this.selectedIds.size > 0 && !this.isAllSelected();
  }

  /**
   * Set callback for selection changes
   * @param {Function} callback
   */
  onChange(callback) {
    this.onSelectionChange = callback;
  }

  /**
   * Notify listeners of selection change
   * @private
   */
  _notifyChange() {
    if (this.onSelectionChange) {
      this.onSelectionChange({
        selectedIds: this.getSelectedIds(),
        count: this.getSelectedCount(),
        allSelected: this.isAllSelected(),
        someSelected: this.isSomeSelected()
      });
    }
  }

  /**
   * Get items ready for batch processing
   * @param {Array} images - Array of image objects with {fullPath, filename}
   * @returns {Array} - Array of {id, path, filename} ready for batch API
   */
  getSelectedItems(images) {
    const selectedIds = this.getSelectedIds();
    return images
      .filter(img => selectedIds.includes(img.fullPath))
      .map((img, index) => ({
        id: `item_${index}`,
        path: img.fullPath,
        filename: img.filename
      }));
  }
}
