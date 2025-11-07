/**
 * Batch Manager - Simplified version for Image Manipulator
 * Handles job queuing, chunk dispatching, and progress tracking
 * Based on dl-organizer-v2's queue-manager.js but simplified
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

// Item status constants
const ITEM_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
};

// Job status constants
const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  COMPLETED_WITH_ERRORS: 'completed_with_errors',
  CANCELLED: 'cancelled'
};

// Default configuration
const DEFAULT_OPTIONS = {
  chunkSize: 50,        // Process 50 images at a time
  retryCount: 2,        // Retry failed items twice
  overwrite: 'skip',    // skip | overwrite | suffix
  outputFormat: ['json', 'txt']
};

class BatchManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.defaultOptions = { ...DEFAULT_OPTIONS, ...(options.defaultOptions || {}) };
    this.jobs = new Map();  // In-memory job storage
  }

  /**
   * Create a new batch job
   * @param {Array} items - Array of {id, path, filename}
   * @param {Object} options - Job options
   * @returns {string} jobId
   */
  createJob(items, options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Cannot create job with empty items array');
    }
    if (items.length > this.maxQueueSize) {
      throw new Error(`Batch size ${items.length} exceeds maximum ${this.maxQueueSize}`);
    }

    const jobId = options.jobId || `batch_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const mergedOptions = {
      ...this.defaultOptions,
      ...options
    };

    // Initialize queue items
    const queueItems = items.map((item, index) => ({
      id: item.id || `${jobId}_item_${index}`,
      path: item.path,
      filename: item.filename || this._getFilename(item.path),
      status: ITEM_STATUS.PENDING,
      retries: 0,
      error: null,
      result: null,
      savedFiles: null,
      startedAt: null,
      completedAt: null
    }));

    // Create job object
    const job = {
      id: jobId,
      status: JOB_STATUS.QUEUED,
      options: mergedOptions,
      controls: {
        paused: false,
        cancelRequested: false,
        chunkSize: mergedOptions.chunkSize
      },
      stats: {
        total: queueItems.length,
        pending: queueItems.length,
        processing: 0,
        completed: 0,
        failed: 0,
        skipped: 0
      },
      queue: queueItems,
      createdAt: now,
      startedAt: null,
      completedAt: null
    };

    this.jobs.set(jobId, job);

    this.emit('jobCreated', {
      jobId,
      totalItems: queueItems.length,
      options: mergedOptions
    });

    return jobId;
  }

  /**
   * Get job by ID
   * @param {string} jobId
   * @returns {Object|null}
   */
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get job statistics
   * @param {string} jobId
   * @returns {Object|null}
   */
  getJobStats(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      id: job.id,
      status: job.status,
      stats: job.stats,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt
    };
  }

  /**
   * Get next chunk of pending items
   * @param {string} jobId
   * @returns {Array}
   */
  getNextChunk(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return [];

    const chunkSize = job.controls.chunkSize;
    const pendingItems = job.queue.filter(item => item.status === ITEM_STATUS.PENDING);

    return pendingItems.slice(0, chunkSize);
  }

  /**
   * Update item status
   * @param {string} jobId
   * @param {string} itemId
   * @param {string} status
   * @param {Object} updates - Additional updates (error, result, savedFiles, etc.)
   */
  updateItemStatus(jobId, itemId, status, updates = {}) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const item = job.queue.find(i => i.id === itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in job ${jobId}`);
    }

    const oldStatus = item.status;
    item.status = status;

    // Apply additional updates
    Object.assign(item, updates);

    // Update timestamps
    if (status === ITEM_STATUS.PROCESSING && !item.startedAt) {
      item.startedAt = new Date().toISOString();
    }
    if ([ITEM_STATUS.COMPLETED, ITEM_STATUS.FAILED, ITEM_STATUS.SKIPPED].includes(status)) {
      item.completedAt = new Date().toISOString();
    }

    // Update job stats
    this._updateJobStats(job, oldStatus, status);

    // Emit item status update
    this.emit('itemStatusChanged', {
      jobId,
      itemId,
      oldStatus,
      newStatus: status,
      item
    });

    // Check if job is complete
    this._checkJobCompletion(jobId);
  }

  /**
   * Mark job as started
   * @param {string} jobId
   */
  startJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = JOB_STATUS.PROCESSING;
    job.startedAt = new Date().toISOString();

    this.emit('jobStarted', { jobId });
  }

  /**
   * Pause job processing
   * @param {string} jobId
   */
  pauseJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.controls.paused = true;
    job.status = JOB_STATUS.PAUSED;

    this.emit('jobPaused', { jobId });
  }

  /**
   * Resume job processing
   * @param {string} jobId
   */
  resumeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.controls.paused = false;
    job.status = JOB_STATUS.PROCESSING;

    this.emit('jobResumed', { jobId });
  }

  /**
   * Cancel job
   * @param {string} jobId
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.controls.cancelRequested = true;
    job.status = JOB_STATUS.CANCELLED;
    job.completedAt = new Date().toISOString();

    this.emit('jobCancelled', { jobId });
  }

  /**
   * Get all jobs
   * @returns {Array}
   */
  getAllJobs() {
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      status: job.status,
      stats: job.stats,
      createdAt: job.createdAt
    }));
  }

  /**
   * Delete job
   * @param {string} jobId
   */
  deleteJob(jobId) {
    this.jobs.delete(jobId);
    this.emit('jobDeleted', { jobId });
  }

  // Private methods

  /**
   * Update job statistics based on item status change
   */
  _updateJobStats(job, oldStatus, newStatus) {
    // Decrement old status count
    if (oldStatus === ITEM_STATUS.PENDING) job.stats.pending--;
    else if (oldStatus === ITEM_STATUS.PROCESSING) job.stats.processing--;
    else if (oldStatus === ITEM_STATUS.COMPLETED) job.stats.completed--;
    else if (oldStatus === ITEM_STATUS.FAILED) job.stats.failed--;
    else if (oldStatus === ITEM_STATUS.SKIPPED) job.stats.skipped--;

    // Increment new status count
    if (newStatus === ITEM_STATUS.PENDING) job.stats.pending++;
    else if (newStatus === ITEM_STATUS.PROCESSING) job.stats.processing++;
    else if (newStatus === ITEM_STATUS.COMPLETED) job.stats.completed++;
    else if (newStatus === ITEM_STATUS.FAILED) job.stats.failed++;
    else if (newStatus === ITEM_STATUS.SKIPPED) job.stats.skipped++;
  }

  /**
   * Check if job is complete and update status
   */
  _checkJobCompletion(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const { pending, processing } = job.stats;

    // Job is complete when no items are pending or processing
    if (pending === 0 && processing === 0) {
      job.completedAt = new Date().toISOString();

      if (job.stats.failed > 0) {
        job.status = JOB_STATUS.COMPLETED_WITH_ERRORS;
      } else {
        job.status = JOB_STATUS.COMPLETED;
      }

      this.emit('jobCompleted', {
        jobId,
        stats: job.stats,
        status: job.status
      });
    }
  }

  /**
   * Extract filename from path
   */
  _getFilename(path) {
    return path.split('/').pop().split('\\').pop();
  }
}

module.exports = {
  BatchManager,
  ITEM_STATUS,
  JOB_STATUS
};
