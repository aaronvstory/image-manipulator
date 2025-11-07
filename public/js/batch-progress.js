/**
 * Batch Progress Client - SSE client for real-time batch progress tracking
 */

class BatchProgress {
  constructor() {
    this.eventSource = null;
    this.jobId = null;
    this.onUpdate = null;
    this.onComplete = null;
    this.onError = null;
  }

  /**
   * Start listening to batch progress
   * @param {string} jobId
   * @param {Object} callbacks - { onUpdate, onComplete, onError }
   */
  connect(jobId, callbacks = {}) {
    // Close existing connection
    this.disconnect();

    this.jobId = jobId;
    this.onUpdate = callbacks.onUpdate;
    this.onComplete = callbacks.onComplete;
    this.onError = callbacks.onError;

    // Create SSE connection
    const url = `/api/batch/progress/${jobId}?includeItems=true`;
    this.eventSource = new EventSource(url);

    // Handle job updates
    this.eventSource.addEventListener('job-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleUpdate(data);
      } catch (error) {
        console.error('Error parsing job update:', error);
      }
    });

    // Handle connection errors
    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);

      // Check if job is complete (connection closed intentionally)
      if (this.eventSource.readyState === EventSource.CLOSED) {
        this._checkJobStatus();
      } else {
        this._notifyError('Connection error. Retrying...');
      }
    };

    // Handle connection open
    this.eventSource.onopen = () => {
      console.log(`Connected to batch progress for job ${jobId}`);
    };
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.jobId = null;
  }

  /**
   * Check job status via polling (fallback)
   * @private
   */
  async _checkJobStatus() {
    if (!this.jobId) return;

    try {
      const response = await fetch(`/api/batch/status/${this.jobId}?includeItems=true`);
      const data = await response.json();

      if (data.status === 'completed' || data.status === 'completed_with_errors') {
        this._notifyComplete(data);
        this.disconnect();
      } else {
        this._handleUpdate(data);
      }
    } catch (error) {
      console.error('Error checking job status:', error);
      this._notifyError(error.message);
    }
  }

  /**
   * Handle job update
   * @private
   */
  _handleUpdate(data) {
    // Check if job is complete
    const isComplete = data.status === 'completed' ||
                      data.status === 'completed_with_errors' ||
                      data.status === 'cancelled';

    if (isComplete) {
      this._notifyComplete(data);
      this.disconnect();
    } else {
      this._notifyUpdate(data);
    }
  }

  /**
   * Notify update callback
   * @private
   */
  _notifyUpdate(data) {
    if (this.onUpdate) {
      this.onUpdate(data);
    }
  }

  /**
   * Notify completion callback
   * @private
   */
  _notifyComplete(data) {
    if (this.onComplete) {
      this.onComplete(data);
    }
  }

  /**
   * Notify error callback
   * @private
   */
  _notifyError(message) {
    if (this.onError) {
      this.onError(message);
    }
  }

  /**
   * Pause the current job
   */
  async pause() {
    if (!this.jobId) return;

    try {
      const response = await fetch(`/api/batch/pause/${this.jobId}`, {
        method: 'POST'
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error pausing job:', error);
      return false;
    }
  }

  /**
   * Resume the current job
   */
  async resume() {
    if (!this.jobId) return;

    try {
      const response = await fetch(`/api/batch/resume/${this.jobId}`, {
        method: 'POST'
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error resuming job:', error);
      return false;
    }
  }

  /**
   * Cancel the current job
   */
  async cancel() {
    if (!this.jobId) return;

    try {
      const response = await fetch(`/api/batch/cancel/${this.jobId}`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        this.disconnect();
      }

      return data.success;
    } catch (error) {
      console.error('Error cancelling job:', error);
      return false;
    }
  }

  /**
   * Calculate progress percentage
   * @param {Object} stats
   * @returns {number} - Percentage 0-100
   */
  static calculateProgress(stats) {
    if (!stats || stats.total === 0) return 0;

    const completed = stats.completed + stats.failed + stats.skipped;
    return Math.round((completed / stats.total) * 100);
  }

  /**
   * Format time estimate
   * @param {number} itemsRemaining
   * @param {number} avgTimePerItem - milliseconds
   * @returns {string}
   */
  static formatTimeEstimate(itemsRemaining, avgTimePerItem) {
    if (itemsRemaining === 0) return 'Complete';
    if (!avgTimePerItem) return 'Calculating...';

    const totalMs = itemsRemaining * avgTimePerItem;
    const seconds = Math.ceil(totalMs / 1000);

    if (seconds < 60) {
      return `~${seconds}s remaining`;
    } else {
      const minutes = Math.ceil(seconds / 60);
      return `~${minutes}m remaining`;
    }
  }
}
