/**
 * Batch Processing Routes
 * Handles batch OCR endpoints with SSE progress tracking
 */

const express = require('express');
const router = express.Router();
const { BatchManager, ITEM_STATUS, JOB_STATUS } = require('../services/batch-manager');
const { BatchProcessor } = require('../services/batch-processor');

// Initialize batch manager and processor
const batchManager = new BatchManager();
const batchProcessor = new BatchProcessor(batchManager);

/**
 * POST /api/batch/start
 * Create and start a new batch OCR job
 */
router.post('/start', async (req, res) => {
  try {
    const { items, options = {} } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required and must not be empty'
      });
    }

    // Create job
    const jobId = batchManager.createJob(items, options);

    // Start processing in background
    batchProcessor.processJob(jobId).catch(error => {
      console.error(`Batch job ${jobId} failed:`, error);
    });

    res.json({
      success: true,
      jobId,
      totalItems: items.length,
      options: batchManager.getJob(jobId).options
    });

  } catch (error) {
    console.error('Error starting batch job:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/batch/progress/:jobId
 * Server-Sent Events stream for real-time progress updates
 */
router.get('/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const includeItems = req.query.includeItems === 'true';

  const job = batchManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial snapshot
  const writeSnapshot = (snapshot) => {
    if (!snapshot) return;

    res.write(`event: job-update\n`);
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  };

  const getSnapshot = () => {
    const job = batchManager.getJob(jobId);
    if (!job) return null;

    return {
      jobId: job.id,
      status: job.status,
      stats: job.stats,
      items: includeItems ? job.queue : undefined,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt
    };
  };

  // Send initial state
  writeSnapshot(getSnapshot());

  // Listen to batch manager events
  const eventHandlers = [];

  const registerEvent = (eventName) => {
    const handler = (payload) => {
      if (payload?.jobId !== jobId) return;

      const snapshot = getSnapshot();
      writeSnapshot(snapshot);
    };

    batchManager.on(eventName, handler);
    eventHandlers.push({ eventName, handler });
  };

  registerEvent('jobStarted');
  registerEvent('jobCompleted');
  registerEvent('jobPaused');
  registerEvent('jobResumed');
  registerEvent('jobCancelled');
  registerEvent('itemStatusChanged');

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    if (!res.destroyed) {
      res.write(': heartbeat\n\n');
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on connection close
  req.on('close', () => {
    clearInterval(heartbeat);
    eventHandlers.forEach(({ eventName, handler }) => {
      batchManager.off(eventName, handler);
    });
  });
});

/**
 * GET /api/batch/status/:jobId
 * Get job status (polling fallback for SSE)
 */
router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = batchManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    stats: job.stats,
    items: req.query.includeItems === 'true' ? job.queue : undefined,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt
  });
});

/**
 * POST /api/batch/pause/:jobId
 * Pause a running job
 */
router.post('/pause/:jobId', (req, res) => {
  const { jobId } = req.params;

  try {
    batchManager.pauseJob(jobId);
    res.json({ success: true, jobId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/batch/resume/:jobId
 * Resume a paused job
 */
router.post('/resume/:jobId', (req, res) => {
  const { jobId } = req.params;

  try {
    batchManager.resumeJob(jobId);
    res.json({ success: true, jobId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/batch/cancel/:jobId
 * Cancel a running job
 */
router.post('/cancel/:jobId', (req, res) => {
  const { jobId } = req.params;

  try {
    batchManager.cancelJob(jobId);
    res.json({ success: true, jobId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/batch/jobs
 * List all jobs
 */
router.get('/jobs', (req, res) => {
  const jobs = batchManager.getAllJobs();
  res.json({ jobs });
});

/**
 * DELETE /api/batch/job/:jobId
 * Delete a job
 */
router.delete('/job/:jobId', (req, res) => {
  const { jobId } = req.params;

  try {
    batchManager.deleteJob(jobId);
    res.json({ success: true, jobId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
