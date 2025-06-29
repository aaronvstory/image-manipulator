class ImageRotator {
    constructor() {
        this.images = [];
        this.currentDirectory = '';
        this.lastRotationTime = {};
        this.rotationCooldown = 3000; // 3 seconds cooldown per image
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCurrentDirectory();
        this.setupGridControls();
    }

    bindEvents() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadImages();
        });

        // Folder selection buttons
        document.getElementById('selectFolderBtn').addEventListener('click', () => {
            this.openFolderModal();
        });

        document.getElementById('loadFolderBtn').addEventListener('click', () => {
            const folderPath = document.getElementById('folderPath').value.trim();
            if (folderPath) {
                this.setDirectory(folderPath);
            }
        });

        // Enter key on folder input
        document.getElementById('folderPath').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const folderPath = e.target.value.trim();
                if (folderPath) {
                    this.setDirectory(folderPath);
                }
            }
        });

        // Modal close on background click
        document.getElementById('folderModal').addEventListener('click', (e) => {
            if (e.target.id === 'folderModal') {
                this.closeFolderModal();
            }
        });

        // Modal enter key
        document.getElementById('modalFolderPath').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.confirmFolderSelection();
            }
        });
    }

    setupGridControls() {
        const gridSlider = document.getElementById('gridSize');
        const gridValue = document.getElementById('gridSizeValue');
        const imageGrid = document.getElementById('imageGrid');

        // Set initial grid size
        const initialSize = gridSlider.value;
        imageGrid.style.setProperty('--grid-size', `${initialSize}px`);
        gridValue.textContent = `${initialSize}px`;

        // Handle slider changes
        gridSlider.addEventListener('input', (e) => {
            const size = e.target.value;
            imageGrid.style.setProperty('--grid-size', `${size}px`);
            gridValue.textContent = `${size}px`;
        });
    }

    async loadCurrentDirectory() {
        try {
            const response = await fetch('/api/directory');
            const data = await response.json();
            
            if (data.success) {
                this.currentDirectory = data.directory;
                this.updateCurrentFolderDisplay();
                this.loadImages();
            }
        } catch (error) {
            console.error('Error loading current directory:', error);
            this.loadImages(); // Fallback to loading images anyway
        }
    }

    updateCurrentFolderDisplay() {
        const currentFolderSpan = document.getElementById('currentFolder');
        if (this.currentDirectory) {
            // Show only the last part of the path for better UX
            const folderName = this.currentDirectory.split(/[\\\/]/).pop() || this.currentDirectory;
            currentFolderSpan.textContent = folderName;
            currentFolderSpan.title = this.currentDirectory; // Full path on hover
        } else {
            currentFolderSpan.textContent = 'No folder selected';
            currentFolderSpan.title = '';
        }
    }

    async setDirectory(directoryPath) {
        try {
            this.showLoading();
            
            const response = await fetch('/api/directory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ directory: directoryPath }),
            });

            const data = await response.json();

            if (data.success) {
                this.currentDirectory = data.directory;
                this.updateCurrentFolderDisplay();
                document.getElementById('folderPath').value = '';
                this.showSuccessMessage('Folder loaded successfully!');
                this.loadImages();
            } else {
                this.showError('Failed to set directory: ' + data.error);
            }
        } catch (error) {
            console.error('Error setting directory:', error);
            this.showError('Failed to connect to server');
        } finally {
            this.hideLoading();
        }
    }

    openFolderModal() {
        const modal = document.getElementById('folderModal');
        const input = document.getElementById('modalFolderPath');
        
        // Pre-fill with current directory
        input.value = this.currentDirectory;
        modal.classList.remove('hidden');
        
        // Focus on input
        setTimeout(() => input.focus(), 100);
    }

    closeFolderModal() {
        document.getElementById('folderModal').classList.add('hidden');
    }

    confirmFolderSelection() {
        const folderPath = document.getElementById('modalFolderPath').value.trim();
        if (folderPath) {
            this.closeFolderModal();
            this.setDirectory(folderPath);
        }
    }

    browseForFolder() {
        // In a real Windows app, this would open a native folder dialog
        // For web app, we'll show a helpful message
        this.showBrowseMessage('For security reasons, web browsers cannot open system folder dialogs. Please copy and paste the folder path manually.');
    }

    showBrowseMessage(message) {
        // Create a temporary info message (less alarming than error)
        const infoEl = document.createElement('div');
        infoEl.className = 'info-message';
        infoEl.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>${escapeHtml(message)}</span>
        `;
        infoEl.style.cssText = `
            background: linear-gradient(135deg, #17a2b8, #138496);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            box-shadow: 0 4px 15px rgba(23, 162, 184, 0.3);
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        // Insert into modal body
        const modalBody = document.querySelector('.modal-body');
        modalBody.insertBefore(infoEl, modalBody.firstChild);
        
        // Animate in
        setTimeout(() => infoEl.style.opacity = '1', 10);
        
        // Remove after 4 seconds
        setTimeout(() => {
            infoEl.style.opacity = '0';
            setTimeout(() => {
                if (infoEl.parentNode) {
                    infoEl.parentNode.removeChild(infoEl);
                }
            }, 300);
        }, 4000);
    }

    selectCommonFolder(folderType) {
        const commonPaths = {
            'Pictures': 'C:\\Users\\%USERNAME%\\Pictures',
            'Downloads': 'C:\\Users\\%USERNAME%\\Downloads',
            'Desktop': 'C:\\Users\\%USERNAME%\\Desktop',
            'Documents': 'C:\\Users\\%USERNAME%\\Documents'
        };

        const folderPath = commonPaths[folderType];
        if (folderPath) {
            document.getElementById('modalFolderPath').value = folderPath;
        }
    }

    async loadImages() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/images');
            const data = await response.json();
            
            if (data.success) {
                this.images = data.images;
                this.currentDirectory = data.directory;
                this.updateCurrentFolderDisplay();
                this.updateStats(data.count);
                this.renderImages();
            } else {
                this.showError('Failed to load images: ' + data.error);
            }
        } catch (error) {
            console.error('Error loading images:', error);
            this.showError('Failed to connect to server');
        } finally {
            this.hideLoading();
        }
    }

    showLoading() {
        document.getElementById('loadingIndicator').classList.remove('hidden');
        document.getElementById('loadingGrid').classList.remove('hidden');
        document.getElementById('imageGrid').classList.add('hidden');
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('errorMessage').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loadingIndicator').classList.add('hidden');
        document.getElementById('loadingGrid').classList.add('hidden');
    }

    updateStats(count) {
        document.getElementById('totalImages').textContent = count;
        document.getElementById('imageCount').classList.remove('hidden');
    }

    showError(message) {
        const errorEl = document.getElementById('errorMessage');
        errorEl.querySelector('span').textContent = message;
        errorEl.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorEl.classList.add('hidden');
        }, 5000);
    }

    showSuccessMessage(message) {
        // Create a temporary success message
        const successEl = document.createElement('div');
        successEl.className = 'success-message';
        successEl.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${escapeHtml(message)}</span>
        `;
        successEl.style.cssText = `
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            position: fixed;
            top: 120px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1001;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(successEl);
        
        // Animate in
        setTimeout(() => successEl.style.opacity = '1', 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            successEl.style.opacity = '0';
            setTimeout(() => {
                if (successEl.parentNode) {
                    successEl.parentNode.removeChild(successEl);
                }
            }, 300);
        }, 3000);
    }

    renderImages() {
        const grid = document.getElementById('imageGrid');
        
        if (this.images.length === 0) {
            grid.classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
            return;
        }

        grid.classList.remove('hidden');
        grid.innerHTML = '';

        this.images.forEach((image, index) => {
            const imageCard = this.createImageCard(image, index);
            grid.appendChild(imageCard);
        });
    }

    createImageCard(image, index) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.dataset.index = index;

        const thumbnailUrl = `/api/thumbnail/${encodeURIComponent(image.relativePath)}?t=${Date.now()}`;

        card.innerHTML = `
            <div class="image-thumbnail" onclick="imageRotator.rotateImage(${index}, 90)">
                <img src="${thumbnailUrl}" alt="${escapeHtml(image.filename)}" loading="lazy">
                <div class="rotation-overlay">
                    <i class="fas fa-redo-alt"></i>
                </div>
            </div>
            <div class="image-info">
                <div class="image-filename" title="${escapeHtml(image.relativePath)}">
                    ${escapeHtml(image.filename)}
                </div>
                <div class="image-controls">
                    <button class="btn-rotate btn-rotate-ccw" onclick="imageRotator.rotateImage(${index}, -90)" title="Rotate Counter-Clockwise">
                        <i class="fas fa-undo-alt"></i>
                    </button>
                    <button class="btn-rotate btn-rotate-flip" onclick="imageRotator.rotateImage(${index}, 180)" title="Flip 180°">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="btn-rotate btn-rotate-cw" onclick="imageRotator.rotateImage(${index}, 90)" title="Rotate Clockwise">
                        <i class="fas fa-redo-alt"></i>
                    </button>
                </div>
            </div>
        `;

        // Add hover preview functionality
        this.setupHoverPreview(card, image);

        return card;
    }

    async rotateImage(index, degrees) {
        const image = this.images[index];
        const card = document.querySelector(`[data-index="${index}"]`);
        
        if (!image || !card) return;

        // Check rotation cooldown for this specific image
        const imageKey = image.relativePath;
        const now = Date.now();
        const lastRotation = this.lastRotationTime[imageKey];
        
        if (lastRotation && (now - lastRotation) < this.rotationCooldown) {
            const remainingTime = Math.ceil((this.rotationCooldown - (now - lastRotation)) / 1000);
            this.showThrottleMessage(card, remainingTime);
            return; // IMPORTANT: This prevents the API call completely
        }

        // Prevent multiple simultaneous rotations on the same image
        if (card.classList.contains('processing')) {
            this.showThrottleMessage(card, 2);
            return; // IMPORTANT: This also prevents the API call
        }

        try {
            // Add processing state
            card.classList.add('processing');
            
            // Disable all buttons in this card
            const buttons = card.querySelectorAll('.btn-rotate');
            buttons.forEach(btn => btn.disabled = true);

            const response = await fetch('/api/rotate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imagePath: image.relativePath,
                    degrees: degrees
                }),
            });

            const result = await response.json();

            if (result.success) {
                // Record the rotation time for this image
                this.lastRotationTime[imageKey] = now;
                
                // Show success feedback immediately
                this.showRotationFeedback(card, degrees);
                
                // Wait a moment before updating thumbnail to ensure file is fully written
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Update thumbnail with cache-busting timestamp
                const img = card.querySelector('img');
                const thumbnailUrl = `/api/thumbnail/${encodeURIComponent(image.relativePath)}?t=${Date.now()}`;
                
                // Use a Promise to handle image loading
                await new Promise((resolve, reject) => {
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        img.src = thumbnailUrl;
                        resolve();
                    };
                    tempImg.onerror = () => {
                        console.warn('Thumbnail update failed, using fallback');
                        img.src = thumbnailUrl; // Try anyway
                        resolve();
                    };
                    tempImg.src = thumbnailUrl;
                });
                
            } else {
                this.showError('Failed to rotate image: ' + result.error);
            }
        } catch (error) {
            console.error('Error rotating image:', error);
            this.showError('Network error - please check your connection');
        } finally {
            // Add a small delay before re-enabling buttons to prevent rapid clicking issues
            setTimeout(() => {
                // Remove processing state
                card.classList.remove('processing');
                
                // Re-enable buttons
                const buttons = card.querySelectorAll('.btn-rotate');
                buttons.forEach(btn => btn.disabled = false);
            }, 300);
        }
    }

    showRotationFeedback(card, degrees) {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = 'rotation-feedback';
        feedback.innerHTML = `<i class="fas fa-check"></i> Rotated ${degrees}°`;
        feedback.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(40, 167, 69, 0.9);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.8rem;
            z-index: 10;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        card.style.position = 'relative';
        card.appendChild(feedback);
        
        // Animate in
        setTimeout(() => feedback.style.opacity = '1', 10);
        
        // Remove after delay
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 1500);
    }

    showThrottleMessage(card, remainingSeconds) {
        // Create throttle message element
        const throttleMsg = document.createElement('div');
        throttleMsg.className = 'throttle-message';
        throttleMsg.innerHTML = `<i class="fas fa-clock"></i> Wait ${remainingSeconds}s`;
        throttleMsg.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(251, 146, 60, 0.9);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.8rem;
            z-index: 10;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        card.style.position = 'relative';
        card.appendChild(throttleMsg);
        
        // Animate in
        setTimeout(() => throttleMsg.style.opacity = '1', 10);
        
        // Remove after delay
        setTimeout(() => {
            throttleMsg.style.opacity = '0';
            setTimeout(() => {
                if (throttleMsg.parentNode) {
                    throttleMsg.parentNode.removeChild(throttleMsg);
                }
            }, 300);
        }, 1200);
    }

    setupHoverPreview(card, image) {
        const thumbnail = card.querySelector('.image-thumbnail');
        let hoverTimeout = null;
        let previewElement = null;

        const showPreview = () => {
            // Create hover preview tooltip
            previewElement = document.createElement('div');
            previewElement.className = 'hover-preview-tooltip';
            
            const fullImageUrl = `/api/preview/${encodeURIComponent(image.relativePath)}?t=${Date.now()}`;
            
            previewElement.innerHTML = `
                <div class="preview-header-small">
                    <span class="preview-filename">${escapeHtml(image.filename)}</span>
                </div>
                <div class="preview-image-container">
                    <div class="preview-loading-small">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <img class="preview-image-hover" src="${fullImageUrl}" alt="${escapeHtml(image.filename)}" 
                         onload="this.parentNode.querySelector('.preview-loading-small').style.display='none'; this.style.display='block';"
                         onerror="this.parentNode.innerHTML='<div class=\\'preview-error-small\\'>Failed to load</div>';">
                </div>
            `;
            
            // Position the preview optimally on screen
            const rect = card.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // Preview dimensions (approximate)
            const previewWidth = 650;
            const previewHeight = 500;
            
            let left, top;
            
            // Try to position to the right first
            if (rect.right + previewWidth + 20 < windowWidth) {
                left = rect.right + scrollLeft + 15;
            } 
            // If not enough space on right, try left
            else if (rect.left - previewWidth - 20 > 0) {
                left = rect.left + scrollLeft - previewWidth - 15;
            }
            // If neither side works, center horizontally
            else {
                left = Math.max(10, (windowWidth - previewWidth) / 2 + scrollLeft);
            }
            
            // Vertical positioning - try to center on the card
            top = rect.top + scrollTop - (previewHeight - rect.height) / 2;
            
            // Keep preview within viewport
            if (top < scrollTop + 10) {
                top = scrollTop + 10;
            } else if (top + previewHeight > scrollTop + windowHeight - 10) {
                top = scrollTop + windowHeight - previewHeight - 10;
            }
            
            previewElement.style.position = 'absolute';
            previewElement.style.left = left + 'px';
            previewElement.style.top = top + 'px';
            previewElement.style.zIndex = '10000';
            
            document.body.appendChild(previewElement);
            
            // Animate in
            setTimeout(() => previewElement.classList.add('visible'), 10);
        };

        const hidePreview = () => {
            if (previewElement) {
                previewElement.classList.remove('visible');
                setTimeout(() => {
                    if (previewElement && previewElement.parentNode) {
                        previewElement.parentNode.removeChild(previewElement);
                    }
                    previewElement = null;
                }, 200);
            }
        };

        const clearHoverTimeout = () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
        };

        // Mouse enter - start timer
        thumbnail.addEventListener('mouseenter', () => {
            clearHoverTimeout();
            hoverTimeout = setTimeout(showPreview, 2000); // Reduced to 2 seconds
        });

        // Mouse leave - hide preview immediately
        thumbnail.addEventListener('mouseleave', () => {
            clearHoverTimeout();
            hidePreview();
        });
    }

    hidePreview() {
        const previewElement = document.querySelector('.image-preview-overlay');
        if (previewElement) {
            previewElement.classList.remove('visible');
            setTimeout(() => {
                if (previewElement.parentNode) {
                    previewElement.parentNode.removeChild(previewElement);
                }
            }, 300);
        }
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Initialize the app
const imageRotator = new ImageRotator();

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        window.imageRotator.loadImages();
    }
    
    // Close preview with Escape key (for any hover previews)
    if (e.key === 'Escape') {
        const previewElements = document.querySelectorAll('.hover-preview-tooltip.visible');
        previewElements.forEach(preview => {
            preview.classList.remove('visible');
            setTimeout(() => {
                if (preview.parentNode) {
                    preview.parentNode.removeChild(preview);
                }
            }, 200);
        });
    }
});
