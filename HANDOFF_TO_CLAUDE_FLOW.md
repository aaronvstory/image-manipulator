# Claude Flow Handoff: Image-Manipulator Batch OCR Implementation

## 🎯 Mission Objective

Port **minimal working OCR batch processing** from `dl-organizer-v2` to `image-manipulator` for a clean, lightweight implementation.

**Goal**: Implement 5 critical features for production-ready batch OCR processing of 300+ driver's license images.

---

## 📂 Repository Locations

- **Source (Big App)**: `/home/d0nbx/code/dl-organizer-v2`
  - Next.js 15.4 + Express backend (port 3003)
  - Complex, feature-rich, battle-tested OCR system

- **Target (Small App)**: `/home/d0nbx/code/image-manipulator`
  - Pure Node.js/Express v2.0.0
  - Currently: Basic image rotation + thumbnail generation
  - Need: Batch OCR capabilities

---

## 📊 Current State

### What Works in image-manipulator
✅ Express server with file upload
✅ Thumbnail generation
✅ Image grid UI
✅ Basic file operations

### What's Broken/Missing
❌ No batch OCR processing
❌ No image selection (checkboxes)
❌ No progress tracking
❌ No batch size limits (would crash on 330 images)
❌ No skip logic for already-processed files

---

## 🔍 Claude Flow Analysis Results

**Document Reference**: `/home/d0nbx/code/image-manipulator/docs/OCR_FEATURES_TO_PORT.md`

### ✅ Features Found in dl-organizer-v2 (4/5)

#### 1. Batch Size Limit ✅
- **File**: `backend/services/queue-manager.js` (920 lines)
- **Implementation**:
  ```javascript
  const DEFAULT_OPTIONS = {
    chunkSize: 50,        // Process 50 at a time
    concurrency: 4,       // 4 parallel workers
    maxQueueSize: 1000,   // Max total items
    retryCount: 2
  };
  ```
- **What it does**: Prevents memory crashes by chunking large batches

#### 2. Image Selection UI ✅
- **File**: `src/components/dl-organizer/selection-controls.tsx` (138 lines)
- **Implementation**: Set-based state management
  ```typescript
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Select All Visible
  const selectAllVisible = () => {
    const newSelection = new Set(selectedIds);
    visibleIds.forEach(id => newSelection.add(id));
    onSelectionChange(newSelection);
  };
  ```
- **What it does**: Checkbox multi-select with "Select All", "Clear All" buttons
- **Note**: React component - needs conversion to vanilla JS

#### 3. Progress Tracking ✅
- **Backend**: `backend/routes/batch-ocr.js:284-362` (SSE endpoint)
- **Frontend**: `src/hooks/use-batch-processing.ts` (1014 lines)
- **Implementation**: Server-Sent Events for real-time updates
  ```javascript
  // SSE endpoint
  router.get("/progress/:jobId", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    // Stream progress updates
  });
  ```
- **What it does**: Real-time progress bar, per-item status, time estimation

#### 4. Result Display ✅
- **File**: `src/components/dl-organizer/batch-processing-modal.tsx` (500+ lines)
- **Implementation**: Virtualized list with react-window
- **What it does**: Shows per-item results (success/fail/skip), saved files, errors
- **Note**: Uses react-window for performance with large lists

### ⚠️ Features NOT Found (1/5)

#### 5. Already-Processed Detection ❌
- **Status**: Config option exists but **NOT IMPLEMENTED**
- **Found**: `overwrite: 'skip'` in queue-manager.js:40
- **Missing**: No code actually checks for existing `.ocr.json` files!
- **Must Implement**:
  ```javascript
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

## 🗺️ Implementation Plan

### Phase 1: Backend Foundation (6-8 hours) 🔴 START HERE

**Priority Files to Port:**

1. **QueueManager** (`backend/services/queue-manager.js`)
   - Extract: Lines 45-920
   - Core batch management logic
   - Job stats tracking (pending, processing, completed, failed, skipped)
   - Chunk-based processing
   - **IMPORTANT**: Keep the interface simple, don't need all 920 lines

2. **Batch API Routes** (`backend/routes/batch-ocr.js`)
   - Extract key endpoints:
     - `POST /process-batch-new` (lines 782-802) - Start batch job
     - `GET /progress/:jobId` (lines 284-362) - SSE progress stream
     - `POST /batch-action/:action` - Pause/resume/cancel controls

3. **File Existence Check** (NEW CODE NEEDED)
   - Implement skip logic from scratch
   - Check for `*_ocr_results.json` before processing
   - Update item status to "skipped" if file exists

4. **FileManager** (`backend/services/file-manager.js`)
   - Extract: Result saving logic (lines 49-97, 167-201)
   - Saves `.ocr_results.json` and `.ocr_results.txt` next to images

**Configuration to Add:**
```javascript
// config/batch.js
module.exports = {
  chunkSize: 50,
  concurrency: 4,
  maxQueueSize: 1000,
  retryCount: 2,
  overwriteMode: 'skip', // skip | overwrite | suffix
  sseHeartbeatInterval: 30000
};
```

### Phase 2: Frontend Selection UI (2-3 hours)

**Convert React to Vanilla JS:**

1. **Selection State** (from selection-controls.tsx)
   - Replace React state with plain JavaScript Set
   - DOM manipulation for checkbox updates

   ```javascript
   // Pure JS version
   class ImageSelection {
     constructor() {
       this.selectedIds = new Set();
     }

     selectAll(imageIds) {
       imageIds.forEach(id => this.selectedIds.add(id));
       this.updateUI();
     }

     clearAll() {
       this.selectedIds.clear();
       this.updateUI();
     }
   }
   ```

2. **UI Controls**
   - Add checkboxes to image grid
   - "Select All Visible" button
   - "Select All in Folder" button (ignore filters)
   - "Clear All" button
   - Badge showing selected count

### Phase 3: Progress & Results (4-6 hours)

1. **SSE Progress Updates**
   - Frontend EventSource connection
   - Update progress bar in real-time
   - Display per-item status

   ```javascript
   const eventSource = new EventSource(`/api/batch/progress/${jobId}`);

   eventSource.addEventListener('job-update', (event) => {
     const data = JSON.parse(event.data);
     updateProgressBar(data.stats);
     updateItemList(data.items);
   });
   ```

2. **Results Modal**
   - Show batch progress (total, completed, failed, skipped)
   - List of processed items with status
   - View saved results (JSON/TXT)
   - Retry failed items button

---

## 🏗️ Architecture Guidance

### Backend Structure

```
backend/
├── services/
│   ├── batch/
│   │   ├── queue-manager.js      ← Port from dl-organizer-v2
│   │   ├── batch-orchestrator.js ← Simplified version
│   │   └── file-checker.js       ← NEW: Skip logic
│   └── file-manager.js           ← Port result saving
├── routes/
│   └── batch-ocr.js              ← Port SSE endpoints
└── config/
    └── batch.js                   ← NEW: Batch settings
```

### Frontend Structure

```
public/
├── js/
│   ├── batch-selection.js        ← Convert from React
│   ├── batch-progress.js         ← SSE client
│   └── batch-modal.js            ← Results display
└── css/
    └── batch.css                  ← Styles for batch UI
```

---

## 🎨 React → Vanilla JS Conversion Strategy

**What to Port:**
- State management logic (Set operations)
- Event handlers
- UI update logic

**What to Skip:**
- React hooks (useState, useEffect, useCallback)
- JSX syntax
- Component lifecycle

**Conversion Pattern:**
```javascript
// React (source)
const [selectedIds, setSelectedIds] = useState(new Set());

useEffect(() => {
  updateUI();
}, [selectedIds]);

// Vanilla JS (target)
class BatchUI {
  constructor() {
    this.selectedIds = new Set();
  }

  updateSelection(newIds) {
    this.selectedIds = newIds;
    this.render(); // Direct DOM update
  }
}
```

---

## ✅ Success Criteria

**Minimal Working Push Checklist:**

1. ✅ **Batch Size Control**
   - Can set batch size (e.g., 50 images)
   - Processes in chunks, not all at once
   - No memory crashes on 330 images

2. ✅ **Already-Processed Detection**
   - Checks for `*_ocr_results.json` before processing
   - Skips images that have results
   - Updates stats: "X skipped"

3. ✅ **Image Selection**
   - Checkboxes on image grid
   - "Select All" / "Clear All" buttons
   - Badge shows selected count

4. ✅ **Progress Tracking**
   - Real-time progress bar
   - Shows: X/Y completed
   - Per-item status (pending, processing, completed, failed, skipped)

5. ✅ **Result Storage**
   - Saves `imagename_ocr_results.json` next to image
   - Saves `imagename_ocr_results.txt` (optional)
   - Can view saved results

6. ✅ **Error Handling**
   - Failed items shown with error messages
   - Retry button for failed items
   - Doesn't crash entire batch on single failure

---

## 🧪 Testing Plan

**Phase 1 Test (Backend):**
```bash
# Start server
cd /home/d0nbx/code/image-manipulator
npm start

# Test batch endpoint with curl
curl -X POST http://localhost:3000/api/batch/process-batch-new \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "1", "path": "/path/to/image1.jpg"},
      {"id": "2", "path": "/path/to/image2.jpg"}
    ],
    "options": {"chunkSize": 10, "overwrite": "skip"}
  }'

# Test SSE progress
curl -N http://localhost:3000/api/batch/progress/{jobId}
```

**Phase 2 Test (Selection):**
- Load image grid
- Click "Select All" → All checkboxes checked
- Click "Clear All" → All checkboxes unchecked
- Manually select 5 images → Badge shows "5 selected"

**Phase 3 Test (Full Integration):**
- Select 10 images
- Click "Start Batch OCR"
- Watch progress bar update
- Verify results saved as `.ocr_results.json`
- Run again with same images → All 10 skipped

---

## 🚨 Critical Reminders

1. **Work in WSL**: `/home/d0nbx/code/image-manipulator`
   - NOT Windows: `C:\claude\image-rotator`

2. **Don't Over-Engineer**
   - We want MINIMAL working push
   - Skip: worker threads, complex orchestration, persistence/resumability
   - Keep: batch size limits, progress tracking, skip logic

3. **Implement Skip Logic**
   - The big app has the config but NO implementation
   - This is NEW CODE you must write from scratch
   - Check `fs.access()` for `*_ocr_results.json` existence

4. **Test Small First**
   - Start with 5 images
   - Then 20 images
   - Then 100 images
   - Finally 330 images

5. **SSE Compatibility**
   - Ensure Express supports Server-Sent Events
   - Keep connection alive with heartbeat
   - Handle connection drops gracefully

6. **File Naming Convention**
   - Source image: `image.jpg`
   - OCR result: `image_ocr_results.json`
   - TXT result: `image_ocr_results.txt`
   - Use underscore, not dash: `_ocr_results` not `-ocr-results`

---

## 📚 Key Files Reference

### Must Read Files

1. **Queue Management**: `/home/d0nbx/code/dl-organizer-v2/backend/services/queue-manager.js`
   - Focus on: Lines 36-120 (options and enqueueBatch)
   - Focus on: Lines 240-290 (updateItemStatus)

2. **SSE Progress**: `/home/d0nbx/code/dl-organizer-v2/backend/routes/batch-ocr.js`
   - Focus on: Lines 284-362 (progress endpoint)

3. **Selection UI**: `/home/d0nbx/code/dl-organizer-v2/src/components/dl-organizer/selection-controls.tsx`
   - Focus on: Lines 42-65 (selection logic)
   - Convert from React to vanilla JS

4. **File Saving**: `/home/d0nbx/code/dl-organizer-v2/backend/services/file-manager.js`
   - Focus on: Lines 49-97 (saveOCRResults)
   - Focus on: Lines 167-201 (saveJSONResult)

### Full Documentation

Comprehensive analysis: `/home/d0nbx/code/image-manipulator/docs/OCR_FEATURES_TO_PORT.md`

---

## 🚀 Kickoff Commands

```bash
# Navigate to project
cd /home/d0nbx/code/image-manipulator

# Read this handoff doc
cat HANDOFF_TO_CLAUDE_FLOW.md

# Read full analysis
cat docs/OCR_FEATURES_TO_PORT.md

# Check current server setup
npm run dev

# Start implementation
# Phase 1: Create backend/services/batch/queue-manager.js
```

---

## 💬 Claude Flow Start Prompt

```
I need to implement minimal batch OCR processing as described in HANDOFF_TO_CLAUDE_FLOW.md.

Please:
1. Read HANDOFF_TO_CLAUDE_FLOW.md thoroughly
2. Read docs/OCR_FEATURES_TO_PORT.md for detailed analysis
3. Start with Phase 1: Backend Foundation
4. Focus on the 5 critical features (batch size, skip logic, selection, progress, results)

Key points:
- Work in WSL at /home/d0nbx/code/image-manipulator
- Port code from /home/d0nbx/code/dl-organizer-v2
- Convert React components to vanilla JS
- IMPLEMENT skip logic (missing in source!)
- Keep it minimal - we want a working push, not perfect

Ready to start?
```

---

## 📝 Notes for Claude Flow

- **Be Surgical**: Extract only what's needed, don't copy entire files
- **Test Incrementally**: Backend first, then frontend, then integration
- **Document Changes**: Update this file with progress
- **Ask Questions**: If unclear about architecture decisions, ask user
- **Commit Often**: Small, focused commits as you complete each sub-task

---

## ⏱️ Time Estimates

| Phase | Task | Time | Priority |
|-------|------|------|----------|
| 1 | QueueManager port | 3-4h | HIGH |
| 1 | Batch API routes | 2-3h | HIGH |
| 1 | Skip logic implementation | 1-2h | HIGH |
| 2 | Selection UI conversion | 2-3h | MEDIUM |
| 3 | Progress tracking | 2-3h | HIGH |
| 3 | Results modal | 2-3h | MEDIUM |
| - | Testing & debugging | 2-3h | HIGH |
| **Total** | | **14-21h** | |

---

## 🎯 Definition of Done

**Minimal Working Push Complete When:**

1. ✅ User can select multiple images with checkboxes
2. ✅ User can click "Start Batch OCR" button
3. ✅ System processes max 50 images at a time (configurable)
4. ✅ Progress bar updates in real-time showing X/Y completed
5. ✅ Results saved as `*_ocr_results.json` next to each image
6. ✅ Re-running batch skips already-processed images
7. ✅ User can see which images succeeded/failed/skipped
8. ✅ System doesn't crash on 330+ images

---

**Document Created**: 2025-11-06
**Last Updated**: 2025-11-06
**Status**: Ready for Claude Flow Implementation
**Priority**: HIGH

---

Good luck! 🚀
