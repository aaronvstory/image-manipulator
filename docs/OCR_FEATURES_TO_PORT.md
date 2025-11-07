# OCR Features to Port from dl-organizer-v2

## Summary
This document maps the minimal OCR feature set to port from dl-organizer-v2-main to image-manipulator for a "minimal working push" with batch OCR capabilities.

**Source Repository**: `/home/d0nbx/code/dl-organizer-v2` (Next.js 15.4 + Express backend)
**Target Repository**: `/home/d0nbx/code/image-manipulator` (Node.js/Express v2.0.0)

---

## ✅ Critical Features Found

### 1. Batch Size Limit ✅ IMPLEMENTED

**Location**: `backend/services/queue-manager.js`

**Key Code**:
```javascript
const DEFAULT_OPTIONS = {
  chunkSize: 50,           // Batch size limit
  concurrency: 4,          // Concurrent workers
  retryCount: 2,
  maxQueueSize: 1000,      // Maximum total items
  overwrite: 'skip',
  outputFormat: ['txt', 'json'],
  language: 'eng'
};
```

**What to Port**:
- `QueueManager` class (lines 45-920)
- Configurable batch size controls
- Job stats tracking (pending, processing, completed, failed, skipped, retried)
- Chunk-based processing

---

### 2. Already Processed Detection ⚠️ PARTIALLY IMPLEMENTED

**Location**: `backend/services/queue-manager.js:40`

**Status**: Option exists but **file existence check logic NOT IMPLEMENTED**

**Finding**:
- Configuration option `overwrite: 'skip'` exists
- NO code found that checks for existing `.ocr.json` files
- "skip" status only set when jobs are cancelled (queue-manager.js:454, 463)

**What to Implement from Scratch**:
```javascript
// Pseudo-code for missing skip logic
async function shouldSkipProcessing(imagePath, options) {
  if (options.overwrite !== 'skip') return false;

  const jsonPath = imagePath.replace(/\.[^.]+$/, '_ocr_results.json');
  try {
    await fs.access(jsonPath);
    return true; // File exists, skip
  } catch {
    return false; // File doesn't exist, process
  }
}
```

---

### 3. Image Selection UI (Checkboxes) ✅ IMPLEMENTED

**Location**: `src/components/dl-organizer/selection-controls.tsx`

**Key Features**:
- Multi-select mode with Set-based state management
- "Select All Visible" button
- "Select All in Folder" button (ignores filters)
- "Clear All" button
- Badge showing count of selected images
- Additive selection (keeps selections across filter changes)

**Key Code**:
```typescript
// State management
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// Select all visible (additive)
const selectAllVisible = () => {
  const newSelection = new Set(selectedIds);
  visibleIds.forEach(id => newSelection.add(id));
  onSelectionChange(newSelection);
};

// Select all in folder (ignore filters)
const selectAllInFolder = () => {
  const allIds = new Set(totalImages.map(img => img.id));
  onSelectionChange(allIds);
};
```

**What to Port**:
- SelectionControls component (138 lines)
- Set-based state management pattern
- UI controls for batch selection

---

### 4. Progress Tracking ✅ IMPLEMENTED

**Location**: Multiple files

**SSE Progress Streaming**: `backend/routes/batch-ocr.js:284-362`
```javascript
router.get("/progress/:jobId", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send progress updates
  res.write(`event: job-update\n`);
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    if (!res.destroyed) {
      res.write(": heartbeat\n\n");
    }
  }, 30000);
});
```

**Frontend Hook**: `src/hooks/use-batch-processing.ts` (1014 lines)
```typescript
const useBatchProcessing = () => {
  // State management
  const [batchProgress, setBatchProgress] = useState({
    status: 'idle',
    totalImages: 0,
    processedImages: 0,
    successfulImages: 0,
    failedImages: 0,
    skippedImages: 0,
    currentImage: null,
    elapsedTime: 0,
    estimatedTimeRemaining: null
  });

  // SSE connection
  const attachEventSource = useCallback((jobId, options) => {
    const eventSource = new EventSource(`/api/batch-ocr/progress/${jobId}?includeItems=true`);

    eventSource.addEventListener('job-update', (event) => {
      const data = JSON.parse(event.data);
      // Update progress state
    });
  }, []);
};
```

**What to Port**:
- SSE endpoint for real-time updates
- useBatchProcessing hook
- Progress state management
- Per-item status tracking (pending, processing, completed, failed, skipped)
- Duration tracking and estimation

---

### 5. Result Display ✅ IMPLEMENTED

**Location**: `src/components/dl-organizer/batch-processing-modal.tsx`

**Key Features**:
- Virtualized list rendering (react-window) for large batches
- Per-item cards showing:
  - Status indicators (pending, processing, completed, failed, skipped)
  - Processing duration
  - Saved files (JSON, TXT) with view buttons
  - Error messages for failed items
  - Warnings array
  - Retry buttons for failed items

**What to Port**:
- BatchProcessingModal component (500+ lines)
- Virtualized list for performance
- Per-item result display
- Retry and error handling UI

---

## File Structure Mapping

### Backend Services to Port

| Source File | Purpose | Lines | Priority |
|------------|---------|-------|----------|
| `backend/services/queue-manager.js` | Queue management, batch controls | 920 | HIGH |
| `backend/services/batch-orchestrator.js` | Job orchestration | 400+ | HIGH |
| `backend/services/ui-state-handler.js` | UI state tracking | 500+ | HIGH |
| `backend/services/worker-pool.js` | Worker thread pool | 300+ | MEDIUM |
| `backend/services/batch-persistence.js` | Job persistence/resumability | 200+ | LOW |
| `backend/services/file-manager.js` | Result file saving | 434 | HIGH |
| `backend/routes/batch-ocr.js` | Batch API endpoints | 1146 | HIGH |

### Frontend Components to Port

| Source File | Purpose | Lines | Priority |
|------------|---------|-------|----------|
| `src/hooks/use-batch-processing.ts` | Batch state management | 1014 | HIGH |
| `src/components/dl-organizer/selection-controls.tsx` | Image selection UI | 138 | HIGH |
| `src/components/dl-organizer/batch-processing-modal.tsx` | Progress modal | 500+ | HIGH |
| `src/hooks/use-ocr-handlers.ts` | OCR handlers | 270 | MEDIUM |

---

## Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Port QueueManager with batch size controls
- [ ] Port BatchOrchestrator for job coordination
- [ ] **Implement file existence check for skip logic** (new code needed)
- [ ] Port FileManager for result saving
- [ ] Create batch-ocr API routes with SSE support

### Phase 2: Frontend Selection & Progress
- [ ] Port SelectionControls component
- [ ] Implement Set-based selection state
- [ ] Port useBatchProcessing hook
- [ ] Connect SSE progress updates
- [ ] Add selection badges and controls

### Phase 3: Result Display
- [ ] Port BatchProcessingModal
- [ ] Implement virtualized list rendering
- [ ] Add per-item status display
- [ ] Wire up retry functionality
- [ ] Add error/warning display

### Phase 4: Integration
- [ ] Connect backend to OCR service
- [ ] Wire frontend to batch API
- [ ] Test with small batch (10 images)
- [ ] Test with medium batch (50 images)
- [ ] Test with large batch (300+ images)

---

## Key Dependencies to Add

```json
{
  "dependencies": {
    "react-window": "^1.8.10"  // Virtualized list rendering
  }
}
```

---

## Configuration to Add

**Backend (.env or config):**
```bash
BATCH_CHUNK_SIZE=50
BATCH_CONCURRENCY=4
BATCH_MAX_QUEUE_SIZE=1000
BATCH_RETRY_COUNT=2
BATCH_OVERWRITE_MODE=skip  # skip | overwrite | suffix
```

**Frontend (constants):**
```typescript
export const BATCH_DEFAULTS = {
  chunkSize: 20,
  concurrency: 4,
  retryCount: 2,
  sseHeartbeatInterval: 30000,
  progressUpdateInterval: 1000
};
```

---

## Critical Notes

1. **Skip Logic Not Implemented**: The `overwrite: 'skip'` option exists but the actual file existence check is missing. This MUST be implemented from scratch.

2. **Next.js vs Express**: Source uses Next.js API routes. Target uses pure Express. Adapt route handling accordingly.

3. **Worker Threads**: Source uses `OCRWorkerPool` with worker threads for image preprocessing. Assess if needed for target app.

4. **SSE Compatibility**: Ensure Express version supports Server-Sent Events properly.

5. **Memory Management**: Source implements memory pressure detection and backpressure. Consider for large batches (300+ images).

---

## Estimated Effort

| Task | Complexity | Estimated Time |
|------|-----------|---------------|
| Backend queue management | Medium | 4-6 hours |
| Skip logic implementation | Low | 1-2 hours |
| SSE progress tracking | Medium | 3-4 hours |
| Frontend selection UI | Low | 2-3 hours |
| Batch processing hook | High | 4-6 hours |
| Result display modal | Medium | 3-4 hours |
| Integration & testing | Medium | 4-6 hours |
| **Total** | | **21-31 hours** |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
├─────────────────────────────────────────────────────────┤
│  SelectionControls → Set<imageId>                        │
│  useBatchProcessing → SSE Connection                     │
│  BatchProcessingModal → Virtualized List                 │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP + SSE
┌──────────────────────▼──────────────────────────────────┐
│              BACKEND (Express + Routes)                  │
├─────────────────────────────────────────────────────────┤
│  POST /api/batch-ocr/process-batch-new                   │
│  GET  /api/batch-ocr/progress/:jobId (SSE)               │
│  POST /api/batch-ocr/batch-action/:action                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                 BatchOrchestrator                         │
├─────────────────────────────────────────────────────────┤
│  QueueManager (chunking, concurrency, retry)             │
│  UIStateHandler (progress events, SSE data)              │
│  OCRWorkerPool (optional - image preprocessing)          │
│  BatchPersistence (job snapshots for resumability)       │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              OCR Service (per-image)                      │
├─────────────────────────────────────────────────────────┤
│  Check if .ocr.json exists (skip logic)                  │
│  Process image → OCR result                               │
│  FileManager → Save .ocr.json / .txt                      │
└─────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. Review this document with the user
2. Confirm scope and priorities
3. Start with Phase 1: Backend Foundation
4. Implement skip logic (missing feature)
5. Port QueueManager and BatchOrchestrator
6. Create batch API routes
7. Test backend with Postman/curl before frontend work

---

**Document Created**: 2025-11-06
**Source Analysis**: dl-organizer-v2 at `/home/d0nbx/code/dl-organizer-v2`
**Target**: image-manipulator at `/home/d0nbx/code/image-manipulator`
