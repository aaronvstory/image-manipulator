/**
 * Batch Processor - Process batch OCR jobs
 * Orchestrates the processing flow: skip detection → OCR → result saving
 */

const { ITEM_STATUS } = require('./batch-manager');
const { shouldSkipImage } = require('./skip-detector');
const { saveOCRResults } = require('./result-saver');
const { OCRProvider } = require('./ocr-provider');

class BatchProcessor {
  constructor(batchManager) {
    this.batchManager = batchManager;
    this.processingJobs = new Set(); // Track active jobs
    this.ocrProvider = new OCRProvider(); // Real OCR provider
  }

  /**
   * Process a batch job
   * @param {string} jobId
   */
  async processJob(jobId) {
    if (this.processingJobs.has(jobId)) {
      throw new Error(`Job ${jobId} is already being processed`);
    }

    this.processingJobs.add(jobId);

    try {
      const job = this.batchManager.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Mark job as started
      this.batchManager.startJob(jobId);

      // Process in chunks
      while (true) {
        // Check if job was cancelled or paused
        const currentJob = this.batchManager.getJob(jobId);
        if (!currentJob) break;
        if (currentJob.controls.cancelRequested) break;
        if (currentJob.controls.paused) {
          // Wait for resume
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Get next chunk of pending items
        const chunk = this.batchManager.getNextChunk(jobId);

        if (chunk.length === 0) {
          // No more items to process
          break;
        }

        // Process chunk
        await this.processChunk(jobId, chunk);

        // Small delay to allow UI updates and prevent CPU hogging
        await new Promise(resolve => setTimeout(resolve, 10));
      }

    } finally {
      this.processingJobs.delete(jobId);
    }
  }

  /**
   * Process a chunk of items
   * @param {string} jobId
   * @param {Array} chunk
   */
  async processChunk(jobId, chunk) {
    const job = this.batchManager.getJob(jobId);
    if (!job) return;

    const options = job.options;

    // Process items sequentially within chunk
    // (Can be made parallel with concurrency control if needed)
    for (const item of chunk) {
      // Check if cancelled
      const currentJob = this.batchManager.getJob(jobId);
      if (currentJob?.controls.cancelRequested) break;

      try {
        await this.processItem(jobId, item, options);
      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
        // Error is already recorded in processItem
      }
    }
  }

  /**
   * Process a single item
   * @param {string} jobId
   * @param {Object} item
   * @param {Object} options
   */
  async processItem(jobId, item, options) {
    try {
      // Mark as processing
      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PROCESSING);

      // Check if should skip (already processed)
      const skip = await shouldSkipImage(item.path, options);

      if (skip) {
        // Mark as skipped
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.SKIPPED, {
          result: { skipped: true, reason: 'Already processed' }
        });
        return;
      }

      // Perform OCR (PLACEHOLDER - will be replaced with actual OCR)
      const ocrResult = await this.performOCR(item.path, options);

      // Save results
      const saveResult = await saveOCRResults(item.path, ocrResult, options);

      // Mark as completed
      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.COMPLETED, {
        result: ocrResult,
        savedFiles: saveResult.files
      });

    } catch (error) {
      // Mark as failed
      this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.FAILED, {
        error: error.message
      });

      // Check if retryable
      if (item.retries < options.retryCount) {
        // Mark as pending for retry
        this.batchManager.updateItemStatus(jobId, item.id, ITEM_STATUS.PENDING, {
          retries: item.retries + 1
        });
      }
    }
  }

  /**
   * Perform OCR on an image using OpenRouter vision API
   * @param {string} imagePath
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async performOCR(imagePath, options) {
    console.log(`🔍 BatchProcessor: Starting OCR for ${imagePath}`);

    try {
      // Initialize OCR provider if needed
      if (!this.ocrProvider.initialized) {
        await this.ocrProvider.initialize();
      }

      // Process image with real OCR
      const result = await this.ocrProvider.processImage(imagePath, options);

      if (!result.success) {
        throw new Error(result.error || 'OCR processing failed');
      }

      // Parse and validate result
      const parsedData = this.ocrProvider.parseResult(result.data);

      // Return in expected format
      return {
        ...parsedData,
        modelUsed: result.metadata.model,
        processedAt: result.metadata.processedAt,
        processingTimeMs: result.metadata.processingTime,
        cost: result.metadata.cost,
        usage: result.metadata.usage
      };

    } catch (error) {
      console.error(`❌ BatchProcessor: OCR failed for ${imagePath}:`, error.message);
      throw error;
    }
  }
}

module.exports = {
  BatchProcessor
};
