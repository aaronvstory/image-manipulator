# API Reference

Complete documentation for all Image Manipulator REST and Server-Sent Events (SSE) endpoints.

---

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Image Management Endpoints](#image-management-endpoints)
- [Batch OCR Endpoints](#batch-ocr-endpoints)
- [Data Types](#data-types)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Base URL

```
http://localhost:3000
```

All endpoints are prefixed with `/api/` unless noted otherwise.

---

## Authentication

Currently no authentication required. All endpoints are open for localhost access.

> **Production Note:** Implement authentication/authorization before deploying to production.

---

## Image Management Endpoints

### GET /api/directory

Get the current working directory for image operations.

**Request:**
```bash
curl http://localhost:3000/api/directory
```

**Response:**
```json
{
  "success": true,
  "directory": "/home/user/photos"
}
```

**Response (no directory set):**
```json
{
  "success": true,
  "directory": null
}
```

---

### POST /api/directory

Set a new working directory for image operations.

**Request:**
```bash
curl -X POST http://localhost:3000/api/directory \
  -H "Content-Type: application/json" \
  -d '{"directory": "/home/user/photos"}'
```

**Request Body:**
```json
{
  "directory": "/absolute/path/to/images"
}
```

**Response:**
```json
{
  "success": true,
  "directory": "/home/user/photos"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Directory not found"
}
```

---

### GET /api/images

Recursively scan the current directory and return all images.

**Request:**
```bash
curl http://localhost:3000/api/images
```

**Response:**
```json
{
  "success": true,
  "images": [
    {
      "filename": "photo1.jpg",
      "fullPath": "/home/user/photos/photo1.jpg",
      "relativePath": "photo1.jpg",
      "directory": "."
    },
    {
      "filename": "license.jpg",
      "fullPath": "/home/user/photos/dl-scans/license.jpg",
      "relativePath": "dl-scans/license.jpg",
      "directory": "dl-scans"
    }
  ],
  "totalImages": 2
}
```

**Error Response (no directory set):**
```json
{
  "success": false,
  "error": "No directory selected. Please select a directory first.",
  "totalImages": 0
}
```

---

### GET /api/thumbnail/:imagePath

Generate and return a thumbnail for the specified image.

**Parameters:**
- `imagePath` - URL-encoded image path

**Request:**
```bash
curl "http://localhost:3000/api/thumbnail/home%2Fuser%2Fphotos%2Fphoto1.jpg" \
  --output thumbnail.jpg
```

**Response:**
- Content-Type: `image/jpeg`
- Image data (150x150px, center-cropped, 85% quality)

**Error Response:**
```json
{
  "success": false,
  "error": "Image file not found"
}
```

---

### GET /api/preview/:imagePath

Generate and return a larger preview for the specified image.

**Parameters:**
- `imagePath` - URL-encoded image path

**Request:**
```bash
curl "http://localhost:3000/api/preview/home%2Fuser%2Fphotos%2Fphoto1.jpg" \
  --output preview.jpg
```

**Response:**
- Content-Type: `image/jpeg`
- Image data (max 1200x900px, "fit inside", 95% quality)

**Error Response:**
```json
{
  "success": false,
  "error": "Image file not found"
}
```

---

### POST /api/rotate

Rotate an image by the specified degrees.

**Request:**
```bash
curl -X POST http://localhost:3000/api/rotate \
  -H "Content-Type: application/json" \
  -d '{
    "imagePath": "/home/user/photos/photo1.jpg",
    "degrees": 90
  }'
```

**Request Body:**
```json
{
  "imagePath": "/absolute/path/to/image.jpg",
  "degrees": 90  // Must be: 90, 180, or 270
}
```

**Response:**
```json
{
  "success": true,
  "imagePath": "/home/user/photos/photo1.jpg"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "File rotation failed after 3 attempts"
}
```

---

## Batch OCR Endpoints

### POST /api/batch/start

Start a new batch OCR processing job.

**Request:**
```bash
curl -X POST http://localhost:3000/api/batch/start \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "item_1", "path": "/path/to/img1.jpg", "filename": "img1.jpg"},
      {"id": "item_2", "path": "/path/to/img2.jpg", "filename": "img2.jpg"}
    ],
    "options": {
      "chunkSize": 50,
      "overwrite": "skip",
      "saveJSON": true,
      "saveTXT": true
    }
  }'
```

**Request Body:**
```typescript
{
  items: Array<{
    id: string;           // Unique item ID
    path: string;         // Absolute file path
    filename: string;     // Display name
  }>;
  options?: {
    jobId?: string;       // Optional custom job ID
    chunkSize?: number;   // Images per chunk (default: 50)
    overwrite?: string;   // "skip" | "always" (default: "skip")
    saveJSON?: boolean;   // Save JSON results (default: true)
    saveTXT?: boolean;    // Save TXT results (default: true)
    model?: string;       // OCR model override
  };
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "batch_1730940123_abc123",
  "stats": {
    "total": 150,
    "pending": 150,
    "processing": 0,
    "completed": 0,
    "failed": 0,
    "skipped": 0
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "No items provided"
}
```

---

### GET /api/batch/progress/:jobId (Server-Sent Events)

Subscribe to real-time progress updates for a batch job.

**Parameters:**
- `jobId` - The batch job ID from `/api/batch/start`
- `includeItems` (query param) - Set to `true` to include item details

**Request:**
```bash
curl -N "http://localhost:3000/api/batch/progress/batch_123?includeItems=true"
```

**Response (SSE Stream):**

```
event: job-update
data: {"jobId":"batch_123","status":"processing","stats":{"total":150,"pending":100,"processing":1,"completed":48,"failed":1,"skipped":0},"items":[...]}

event: job-update
data: {"jobId":"batch_123","status":"processing","stats":{"total":150,"pending":95,"processing":1,"completed":53,"failed":1,"skipped":0},"items":[...]}

event: job-update
data: {"jobId":"batch_123","status":"completed","stats":{"total":150,"pending":0,"processing":0,"completed":148,"failed":2,"skipped":0},"items":[...]}
```

**Event Format:**
```typescript
{
  jobId: string;
  status: "queued" | "processing" | "paused" | "completed" | "cancelled";
  stats: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
  };
  items?: Array<{
    id: string;
    path: string;
    filename: string;
    status: "pending" | "processing" | "completed" | "failed" | "skipped";
    result?: object;
    error?: string;
    retries: number;
  }>;
}
```

**Heartbeat:**
Server sends a comment every 30 seconds to keep connection alive:
```
: heartbeat
```

---

### POST /api/batch/pause/:jobId

Pause a running batch job.

**Request:**
```bash
curl -X POST http://localhost:3000/api/batch/pause/batch_123
```

**Response:**
```json
{
  "success": true,
  "status": "paused"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Job not found"
}
```

---

### POST /api/batch/resume/:jobId

Resume a paused batch job.

**Request:**
```bash
curl -X POST http://localhost:3000/api/batch/resume/batch_123
```

**Response:**
```json
{
  "success": true,
  "status": "processing"
}
```

---

### POST /api/batch/cancel/:jobId

Cancel a batch job.

**Request:**
```bash
curl -X POST http://localhost:3000/api/batch/cancel/batch_123
```

**Response:**
```json
{
  "success": true,
  "status": "cancelled"
}
```

---

### GET /api/batch/status/:jobId

Get the current status of a batch job (polling alternative to SSE).

**Request:**
```bash
curl http://localhost:3000/api/batch/status/batch_123
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "batch_123",
    "status": "processing",
    "stats": {
      "total": 150,
      "pending": 100,
      "processing": 1,
      "completed": 48,
      "failed": 1,
      "skipped": 0
    },
    "controls": {
      "paused": false,
      "cancelRequested": false,
      "chunkSize": 50
    }
  }
}
```

---

## Data Types

### ImageInfo
```typescript
{
  filename: string;        // "photo.jpg"
  fullPath: string;        // "/home/user/photos/photo.jpg"
  relativePath: string;    // "subfolder/photo.jpg"
  directory: string;       // "subfolder"
}
```

### BatchItem
```typescript
{
  id: string;              // Unique item ID
  path: string;            // Absolute file path
  filename: string;        // Display name
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  result?: OCRResult;      // Only if completed
  error?: string;          // Only if failed
  retries: number;         // Number of retry attempts
}
```

### OCRResult
```typescript
{
  // Personal information
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;    // "YYYY-MM-DD"
  sex?: string;            // "M" | "F" | "X"

  // License information
  licenseNumber?: string;
  state?: string;          // 2-letter state code
  issueDate?: string;      // "YYYY-MM-DD"
  expirationDate?: string; // "YYYY-MM-DD"
  documentClass?: string;  // "C", "D", "M", etc.

  // Address
  address?: string;
  city?: string;
  zipCode?: string;

  // Physical characteristics
  height?: string;         // "6-00" or "180cm"
  weight?: string;         // "180" or "82kg"
  eyeColor?: string;
  hairColor?: string;

  // Additional
  organDonor?: string;     // "yes" | "no" | "unknown"
  restrictions?: string;
  endorsements?: string;

  // Metadata
  cardSide: string;        // "front" | "back" | "selfie" | "unknown"
  documentType: string;    // "drivers_license" | "id_card" | "passport" | "unknown"
  rawText: string;         // Complete OCR text
  confidence: number;      // 0.0 - 1.0

  // Processing metadata
  modelUsed: string;       // "openai/gpt-4o-mini"
  processedAt: string;     // ISO 8601 timestamp
  processingTimeMs: number;
  cost: number;            // USD
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### JobStatus
```typescript
"queued"      // Job created, not started
"processing"  // Currently processing
"paused"      // User paused
"completed"   // All items processed
"cancelled"   // User cancelled
```

### ItemStatus
```typescript
"pending"     // Waiting to be processed
"processing"  // Currently being processed
"completed"   // Successfully processed
"failed"      // Processing failed
"skipped"     // Skipped (already processed)
```

---

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200 OK` - Successful request
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server-side error

### Common Error Messages

**Image Operations:**
- `"No directory selected. Please select a directory first."`
- `"Image file not found"`
- `"File rotation failed after 3 attempts"`

**Batch OCR:**
- `"No items provided"`
- `"Job not found"`
- `"OPENROUTER_API_KEY not configured"`
- `"OCR processing failed"`

---

## Rate Limiting

Current implementation has basic rate limiting:

**Configuration (`.env`):**
```env
RATE_LIMIT_WINDOW=900000  # 15 minutes in ms
RATE_LIMIT_MAX=100        # Max requests per window
```

**OpenRouter Limits:**
- Free tier: 200-500 requests per hour (model-dependent)
- Paid tier: Higher limits based on account

**Exceeded Limit Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later."
}
```

---

## Examples

### Complete Batch OCR Workflow

```bash
# 1. Set directory
curl -X POST http://localhost:3000/api/directory \
  -H "Content-Type: application/json" \
  -d '{"directory": "/home/user/dl-scans"}'

# 2. Get images
curl http://localhost:3000/api/images > images.json

# 3. Start batch (using images from step 2)
curl -X POST http://localhost:3000/api/batch/start \
  -H "Content-Type: application/json" \
  -d @batch-request.json > batch-response.json

# 4. Monitor progress (SSE)
curl -N http://localhost:3000/api/batch/progress/batch_123?includeItems=true

# 5. Check status (polling alternative)
curl http://localhost:3000/api/batch/status/batch_123

# 6. Pause if needed
curl -X POST http://localhost:3000/api/batch/pause/batch_123

# 7. Resume
curl -X POST http://localhost:3000/api/batch/resume/batch_123
```

### JavaScript/Fetch Examples

**Start Batch:**
```javascript
const response = await fetch('/api/batch/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: selectedImages.map((img, i) => ({
      id: `item_${i}`,
      path: img.fullPath,
      filename: img.filename
    })),
    options: {
      chunkSize: 50
    }
  })
});

const data = await response.json();
console.log('Job ID:', data.jobId);
```

**Subscribe to SSE:**
```javascript
const eventSource = new EventSource(`/api/batch/progress/${jobId}?includeItems=true`);

eventSource.addEventListener('job-update', (event) => {
  const data = JSON.parse(event.data);
  console.log('Progress:', data.stats);
  updateUI(data);
});

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

---

## Testing with curl

See [docs/OCR-SETUP-GUIDE.md](OCR-SETUP-GUIDE.md) for complete testing instructions.

---

**API Version:** 2.0.0
**Last Updated:** 2025-11-07
