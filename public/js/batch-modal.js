/**
 * Batch Modal - Display batch progress and results
 */

class BatchModal {
  constructor() {
    this.modal = null;
    this.isOpen = false;
    this.currentJobId = null;
    this.progressClient = null;
    this.startTime = null;
    this.createModal();
  }

  /**
   * Create modal HTML structure
   * @private
   */
  createModal() {
    const modalHTML = `
      <div id="batchModal" class="batch-modal hidden">
        <div class="batch-modal-overlay"></div>
        <div class="batch-modal-content">
          <!-- Header -->
          <div class="batch-modal-header">
            <h2>
              <i class="fas fa-cogs"></i>
              <span id="batchModalTitle">Batch OCR Processing</span>
            </h2>
            <button id="batchModalClose" class="batch-modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Progress Section -->
          <div class="batch-progress-section">
            <div class="batch-stats">
              <div class="batch-stat">
                <span class="stat-label">Total:</span>
                <span id="batchTotal" class="stat-value">0</span>
              </div>
              <div class="batch-stat batch-stat-success">
                <span class="stat-label">Completed:</span>
                <span id="batchCompleted" class="stat-value">0</span>
              </div>
              <div class="batch-stat batch-stat-warning">
                <span class="stat-label">Skipped:</span>
                <span id="batchSkipped" class="stat-value">0</span>
              </div>
              <div class="batch-stat batch-stat-error">
                <span class="stat-label">Failed:</span>
                <span id="batchFailed" class="stat-value">0</span>
              </div>
            </div>

            <div class="batch-progress-bar-container">
              <div class="batch-progress-bar">
                <div id="batchProgressFill" class="batch-progress-fill" style="width: 0%"></div>
              </div>
              <div class="batch-progress-text">
                <span id="batchProgressPercent">0%</span>
                <span id="batchProgressTime">Calculating...</span>
              </div>
            </div>

            <!-- Control Buttons -->
            <div class="batch-controls">
              <button id="batchPauseBtn" class="btn btn-warning">
                <i class="fas fa-pause"></i> Pause
              </button>
              <button id="batchResumeBtn" class="btn btn-success hidden">
                <i class="fas fa-play"></i> Resume
              </button>
              <button id="batchCancelBtn" class="btn btn-danger">
                <i class="fas fa-stop"></i> Cancel
              </button>
            </div>
          </div>

          <!-- Results Section -->
          <div class="batch-results-section">
            <div class="batch-results-header">
              <h3>Processing Results</h3>
              <div class="batch-results-filter">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="completed">Completed</button>
                <button class="filter-btn" data-filter="failed">Failed</button>
                <button class="filter-btn" data-filter="skipped">Skipped</button>
              </div>
            </div>
            <div id="batchResultsList" class="batch-results-list">
              <!-- Results will be populated here -->
            </div>
          </div>

          <!-- Footer -->
          <div class="batch-modal-footer">
            <button id="batchDoneBtn" class="btn btn-primary">
              <i class="fas fa-check"></i> Done
            </button>
          </div>
        </div>
      </div>
    `;

    // Add to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('batchModal');

    // Bind events
    this.bindEvents();
  }

  /**
   * Bind modal events
   * @private
   */
  bindEvents() {
    // Close button
    document.getElementById('batchModalClose').addEventListener('click', () => {
      this.close();
    });

    // Done button
    document.getElementById('batchDoneBtn').addEventListener('click', () => {
      this.close();
    });

    // Pause button
    document.getElementById('batchPauseBtn').addEventListener('click', async () => {
      if (this.progressClient) {
        await this.progressClient.pause();
        this.showResumeButton();
      }
    });

    // Resume button
    document.getElementById('batchResumeBtn').addEventListener('click', async () => {
      if (this.progressClient) {
        await this.progressClient.resume();
        this.showPauseButton();
      }
    });

    // Cancel button
    document.getElementById('batchCancelBtn').addEventListener('click', async () => {
      if (confirm('Are you sure you want to cancel this batch?')) {
        if (this.progressClient) {
          await this.progressClient.cancel();
        }
      }
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        this.applyFilter(filter);

        // Update active state
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Click outside to close
    this.modal.querySelector('.batch-modal-overlay').addEventListener('click', () => {
      if (this.isComplete) {
        this.close();
      }
    });
  }

  /**
   * Open modal and start batch processing
   * @param {string} jobId
   * @param {BatchProgress} progressClient
   */
  open(jobId, progressClient) {
    this.currentJobId = jobId;
    this.progressClient = progressClient;
    this.startTime = Date.now();
    this.isComplete = false;

    // Show modal
    this.modal.classList.remove('hidden');
    this.isOpen = true;

    // Reset UI
    this.reset();

    // Setup progress tracking
    this.progressClient.connect(jobId, {
      onUpdate: (data) => this.handleUpdate(data),
      onComplete: (data) => this.handleComplete(data),
      onError: (error) => this.handleError(error)
    });
  }

  /**
   * Close modal
   */
  close() {
    if (this.progressClient) {
      this.progressClient.disconnect();
    }

    this.modal.classList.add('hidden');
    this.isOpen = false;
    this.currentJobId = null;
  }

  /**
   * Reset modal UI
   * @private
   */
  reset() {
    document.getElementById('batchTotal').textContent = '0';
    document.getElementById('batchCompleted').textContent = '0';
    document.getElementById('batchSkipped').textContent = '0';
    document.getElementById('batchFailed').textContent = '0';
    document.getElementById('batchProgressFill').style.width = '0%';
    document.getElementById('batchProgressPercent').textContent = '0%';
    document.getElementById('batchProgressTime').textContent = 'Calculating...';
    document.getElementById('batchResultsList').innerHTML = '';
    document.getElementById('batchModalTitle').textContent = 'Batch OCR Processing';

    this.showPauseButton();
  }

  /**
   * Handle progress update
   * @private
   */
  handleUpdate(data) {
    const { stats, items } = data;

    // Update stats
    document.getElementById('batchTotal').textContent = stats.total;
    document.getElementById('batchCompleted').textContent = stats.completed;
    document.getElementById('batchSkipped').textContent = stats.skipped;
    document.getElementById('batchFailed').textContent = stats.failed;

    // Update progress bar
    const progress = BatchProgress.calculateProgress(stats);
    document.getElementById('batchProgressFill').style.width = `${progress}%`;
    document.getElementById('batchProgressPercent').textContent = `${progress}%`;

    // Update time estimate
    const elapsed = Date.now() - this.startTime;
    const completed = stats.completed + stats.failed + stats.skipped;
    const avgTime = completed > 0 ? elapsed / completed : 0;
    const remaining = stats.total - completed;
    const estimate = BatchProgress.formatTimeEstimate(remaining, avgTime);
    document.getElementById('batchProgressTime').textContent = estimate;

    // Update results list
    if (items && items.length > 0) {
      this.updateResultsList(items);
    }
  }

  /**
   * Handle batch completion
   * @private
   */
  handleComplete(data) {
    this.isComplete = true;

    const { stats, status } = data;

    // Update title
    const title = status === 'cancelled' ? 'Batch Cancelled' :
                  stats.failed > 0 ? 'Batch Completed with Errors' :
                  'Batch Completed Successfully';
    document.getElementById('batchModalTitle').textContent = title;

    // Hide control buttons
    document.getElementById('batchPauseBtn').classList.add('hidden');
    document.getElementById('batchResumeBtn').classList.add('hidden');
    document.getElementById('batchCancelBtn').classList.add('hidden');

    // Update progress
    this.handleUpdate(data);
    document.getElementById('batchProgressTime').textContent = 'Complete';
  }

  /**
   * Handle error
   * @private
   */
  handleError(error) {
    console.error('Batch processing error:', error);
    // Could show error notification here
  }

  /**
   * Update results list
   * @private
   */
  updateResultsList(items) {
    const container = document.getElementById('batchResultsList');

    // Clear and rebuild
    container.innerHTML = items.map(item => `
      <div class="batch-result-item batch-result-${item.status}" data-status="${item.status}">
        <div class="result-icon">
          ${this.getStatusIcon(item.status)}
        </div>
        <div class="result-info">
          <div class="result-filename">${item.filename}</div>
          ${item.error ? `<div class="result-error">${item.error}</div>` : ''}
        </div>
        <div class="result-status">
          <span class="status-badge status-${item.status}">${item.status}</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Get status icon
   * @private
   */
  getStatusIcon(status) {
    const icons = {
      pending: '<i class="fas fa-clock"></i>',
      processing: '<i class="fas fa-spinner fa-spin"></i>',
      completed: '<i class="fas fa-check-circle"></i>',
      failed: '<i class="fas fa-exclamation-circle"></i>',
      skipped: '<i class="fas fa-forward"></i>'
    };
    return icons[status] || '<i class="fas fa-question-circle"></i>';
  }

  /**
   * Apply filter to results
   * @private
   */
  applyFilter(filter) {
    const items = document.querySelectorAll('.batch-result-item');

    items.forEach(item => {
      if (filter === 'all') {
        item.style.display = '';
      } else {
        const status = item.dataset.status;
        item.style.display = status === filter ? '' : 'none';
      }
    });
  }

  /**
   * Show pause button, hide resume
   * @private
   */
  showPauseButton() {
    document.getElementById('batchPauseBtn').classList.remove('hidden');
    document.getElementById('batchResumeBtn').classList.add('hidden');
  }

  /**
   * Show resume button, hide pause
   * @private
   */
  showResumeButton() {
    document.getElementById('batchPauseBtn').classList.add('hidden');
    document.getElementById('batchResumeBtn').classList.remove('hidden');
  }
}
