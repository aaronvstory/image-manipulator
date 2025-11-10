/**
 * Enhanced Features - Filters, Statistics, and Advanced Selection
 */

// Extend ImageManipulator with new methods
(function() {
    const originalSetupBatchControls = ImageManipulator.prototype.setupBatchControls;

    ImageManipulator.prototype.setupBatchControls = function() {
        // Call original setup
        if (originalSetupBatchControls) {
            originalSetupBatchControls.call(this);
        }

        // Setup filter buttons
        document.querySelectorAll('.batch-filter-controls .filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.applyFilter(filter);

                // Update active state
                document.querySelectorAll('.batch-filter-controls .filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
                e.currentTarget.classList.add('active');
            });
        });

        // Setup "Select All Unprocessed" button
        document.getElementById('selectUnprocessedBtn').addEventListener('click', () => {
            this.selectAllUnprocessed();
        });

        // Setup preset selector
        document.getElementById('presetCount').addEventListener('change', (e) => {
            const customInput = document.getElementById('customCount');
            if (e.target.value === 'custom') {
                customInput.classList.remove('hidden');
                customInput.focus();
            } else {
                customInput.classList.add('hidden');
            }
        });

        // Setup "Select Next X" button
        document.getElementById('selectNextBtn').addEventListener('click', () => {
            this.selectNextUnprocessed();
        });
    };

    // Apply filter to image grid
    ImageManipulator.prototype.applyFilter = function(filter) {
        this.currentFilter = filter;

        const cards = document.querySelectorAll('.image-card');
        cards.forEach((card, index) => {
            const image = this.images[index];
            if (!image) return;

            let shouldShow = true;

            if (filter === 'processed') {
                shouldShow = image.hasOCRResults === true;
            } else if (filter === 'unprocessed') {
                shouldShow = image.hasOCRResults !== true;
            }

            card.style.display = shouldShow ? '' : 'none';
        });

        // Update statistics after filtering
        this.updateStatistics();
    };

    // Update statistics banner
    ImageManipulator.prototype.updateStatistics = function() {
        const total = this.images.length;
        const processed = this.images.filter(img => img.hasOCRResults).length;
        const remaining = total - processed;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statProcessed').textContent = processed;
        document.getElementById('statRemaining').textContent = remaining;
    };

    // Select all unprocessed images
    ImageManipulator.prototype.selectAllUnprocessed = function() {
        this.batchSelection.clearAll();

        const unprocessedIds = this.images
            .filter(img => !img.hasOCRResults)
            .map(img => img.fullPath);

        unprocessedIds.forEach(id => {
            this.batchSelection.selectedIds.add(id);
        });

        this.batchSelection._notifyChange();
    };

    // Select next X unprocessed images
    ImageManipulator.prototype.selectNextUnprocessed = function() {
        const presetDropdown = document.getElementById('presetCount');
        const customInput = document.getElementById('customCount');

        let count;
        if (presetDropdown.value === 'custom') {
            count = parseInt(customInput.value) || 20;
        } else {
            count = parseInt(presetDropdown.value);
        }

        // Clear current selection
        this.batchSelection.clearAll();

        // Find unprocessed images
        const unprocessedImages = this.images.filter(img => !img.hasOCRResults);

        // Select next X
        const toSelect = unprocessedImages.slice(0, count);
        toSelect.forEach(img => {
            this.batchSelection.selectedIds.add(img.fullPath);
        });

        this.batchSelection._notifyChange();

        // Show feedback
        if (toSelect.length < count) {
            alert(`Only ${toSelect.length} unprocessed images available (requested ${count})`);
        }
    };

    // View OCR results for an image
    ImageManipulator.prototype.viewOCRResults = function(imagePath) {
        this.ocrViewer.open(imagePath);
    };

    // Override renderImages to add statistics
    const originalRenderImages = ImageManipulator.prototype.renderImages;
    ImageManipulator.prototype.renderImages = function() {
        originalRenderImages.call(this);
        this.updateStatistics();
    };

    // Override createImageCard to add View Results button
    const originalCreateImageCard = ImageManipulator.prototype.createImageCard;
    ImageManipulator.prototype.createImageCard = function(image, index) {
        const card = originalCreateImageCard.call(this, image, index);

        // Add "View Results" button if OCR results exist
        if (image.hasOCRResults) {
            const infoSection = card.querySelector('.image-info');
            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn-view-ocr';
            viewBtn.innerHTML = '<i class="fas fa-eye"></i> View Results';
            viewBtn.title = 'View OCR Results';
            viewBtn.onclick = (e) => {
                e.stopPropagation();
                this.viewOCRResults(image.fullPath);
            };

            // Insert before controls
            const controls = infoSection.querySelector('.image-controls');
            if (controls) {
                infoSection.insertBefore(viewBtn, controls);
            }
        }

        return card;
    };
})();
