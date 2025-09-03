# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Image Manipulator is a Node.js/Express web application for bulk image rotation with a professional thumbnail grid interface. Built with Sharp for high-performance image processing, it provides efficient folder-based image management with smart hover previews and real-time rotation controls.

## Development Commands

### Starting the Application
```bash
# Quick start (Windows)
start-image-manipulator.bat

# Manual start
npm start       # Starts on http://localhost:3000
npm run dev     # Development mode with nodemon auto-restart

# Set custom directory via environment variable
IMAGE_DIR="C:\Photos" npm start
```

### Testing and Validation
```bash
# Run test suite
test.bat        # Windows batch test script

# Manual server testing
curl http://localhost:3000/api/images
curl http://localhost:3000/api/directory
```

### Cleanup
```bash
# Windows cleanup
cleanup.bat     # Kills Node processes and cleans temp files
```

## Architecture & Key Components

### Backend Architecture (server.js)
- **Express Server**: Serves static files and API endpoints on port 3000
- **Sharp Integration**: High-performance image processing for rotation and thumbnail generation
- **File System Operations**: Recursive directory scanning with robust error handling
- **Retry Logic**: 3-attempt retry system with exponential backoff for Windows file locking issues

### Frontend Architecture
```
public/
├── index.html    # Single-page application interface
├── style.css     # Modern dark theme with glassmorphism effects
└── script.js     # Client-side logic for grid management and API interaction
```

### API Endpoints
- `GET /api/directory` - Get current working directory
- `POST /api/directory` - Set new directory path
- `GET /api/images` - Scan and retrieve all images from directory
- `GET /api/thumbnail/:imagePath` - Generate and serve 150x150 thumbnail
- `GET /api/preview/:imagePath` - Generate larger preview (1200x900 max)
- `POST /api/rotate` - Rotate image by specified degrees

### Image Processing Pipeline
1. **Directory Scanning**: Recursive traversal finding all supported image formats
2. **Thumbnail Generation**: 150x150 center-cropped thumbnails with 85% JPEG quality
3. **Preview Generation**: 1200x900 max "fit inside" previews with 95% quality
4. **Rotation Processing**: Atomic file operations with temp files to prevent corruption

## Critical Implementation Details

### File Rotation Safety (server.js:96-201)
- Uses temporary files with atomic rename operations
- Implements retry logic with exponential backoff (200ms, 400ms, 600ms)
- Handles Windows file locking with specific error codes (EBUSY, EACCES, UNKNOWN)
- Validates file integrity after write operations

### Frontend State Management (script.js)
- **Rotation Throttling**: 3-second cooldown per image stored in `rotationCooldowns` Map
- **Hover Preview System**: 2-second delay with automatic cleanup on mouse leave
- **Dynamic Grid Sizing**: CSS custom properties for real-time thumbnail resizing
- **Error Recovery**: Automatic refresh and clear error display after 5 seconds

### Supported Image Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif)
- TIFF (.tiff)
- BMP (.bmp)

## Common Development Tasks

### Adding New Image Format Support
1. Add extension to `SUPPORTED_EXTENSIONS` array in server.js:19
2. Verify Sharp supports the format
3. Test thumbnail and rotation operations

### Modifying Rotation Behavior
- Rotation logic: server.js:96-201 (`rotateImage` function)
- Frontend controls: script.js rotation button handlers
- Throttling duration: script.js `ROTATION_COOLDOWN` constant

### Customizing UI Theme
- Color scheme: style.css CSS variables (`:root`)
- Grid sizing: Modify `#gridSize` input range in index.html:60
- Hover preview timing: script.js `setupHoverPreviews` function

### Debugging File Lock Issues
- Check server.js:204-210 `isRetryableError` function for error codes
- Monitor console for retry attempts and specific error messages
- Increase retry delays in server.js:114, 151, 177 if needed

## Performance Considerations

### Memory Management
- Thumbnails generated on-demand, not cached server-side
- Preview images use streaming buffers to minimize memory usage
- Frontend lazy-loads images as they enter viewport

### Scalability Limits
- Tested with directories containing 500+ images
- Grid performance degrades beyond 1000 thumbnails (consider pagination)
- File operations are sequential to prevent system overload

## Error Handling Patterns

### Backend Error Recovery
- All async operations wrapped in try-catch blocks
- Specific error messages for common failure modes
- Graceful degradation with user-friendly error responses

### Frontend Error Display
- Toast-style error messages with auto-dismiss
- Visual feedback for operation status (loading spinners, success indicators)
- Countdown timers for rotation cooldown periods

## Security Considerations

- Path traversal prevention via `path.join()` for all file operations
- No file uploads - only operates on existing local files
- Input validation for directory paths and rotation degrees
- No authentication required (localhost-only application)