// Image Manipulator v2.0 - Express Server with Image Processing
const express = require('express');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from public directory
app.use(express.static('public'));
app.use(express.json());

// Configuration - Default target directory for images
// Users can change this through the web interface or set via environment variable
let IMAGE_DIR = process.env.IMAGE_DIR || null;

// Supported image extensions
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp'];

// Check if file is an image
function isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
}

// Recursively scan directory for images
async function scanImagesRecursively(dirPath) {
    let images = [];
    
    try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            
            if (item.isDirectory()) {
                // Recursively scan subdirectories
                const subImages = await scanImagesRecursively(fullPath);
                images.push(...subImages);
            } else if (isImageFile(item.name)) {
                // Add image with relative path info
                const relativePath = path.relative(IMAGE_DIR, fullPath);
                images.push({
                    filename: item.name,
                    fullPath: fullPath,
                    relativePath: relativePath,
                    directory: path.dirname(relativePath)
                });
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
    }
    
    return images;
}

// Generate thumbnail using Sharp
async function generateThumbnail(imagePath) {
    try {
        const thumbnail = await sharp(imagePath)
            .resize(150, 150, { 
                fit: 'cover', 
                position: 'center' 
            })
            .jpeg({ quality: 85 })
            .toBuffer();
        
        return thumbnail;
    } catch (error) {
        console.error(`Error generating thumbnail for ${imagePath}:`, error);
        throw error;
    }
}

// Generate preview (larger version) using Sharp
async function generatePreview(imagePath) {
    try {
        const preview = await sharp(imagePath)
            .resize(1200, 900, { 
                fit: 'inside', 
                withoutEnlargement: false 
            })
            .jpeg({ quality: 95 })
            .toBuffer();
        
        return preview;
    } catch (error) {
        console.error(`Error generating preview for ${imagePath}:`, error);
        throw error;
    }
}

// Rotate image with robust retry logic for Windows file locking
async function rotateImage(imagePath, degrees) {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting to rotate ${imagePath} (attempt ${attempt}/${maxRetries})`);
            
            // Check if file is accessible
            await fs.access(imagePath, fs.constants.R_OK | fs.constants.W_OK);
            
            // Read the original image with retry logic
            let imageBuffer;
            try {
                imageBuffer = await fs.readFile(imagePath);
            } catch (readError) {
                if (attempt < maxRetries && (readError.code === 'EBUSY' || readError.code === 'UNKNOWN')) {
                    console.log(`File read failed (attempt ${attempt}), retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 200 * attempt)); // Exponential backoff
                    continue;
                }
                throw readError;
            }
            
            // Rotate the image
            const rotatedBuffer = await sharp(imageBuffer)
                .rotate(degrees)
                .toBuffer();
            
            // Write back to the original file with retry logic
            try {
                // Try to write to a temporary file first, then rename
                const tempPath = imagePath + '.tmp';
                await fs.writeFile(tempPath, rotatedBuffer);
                
                // Ensure the temp file is fully written
                const fd = await fs.open(tempPath, 'r+');
                try {
                    await fd.sync();
                } finally {
                    await fd.close();
                }
                
                // Rename temp file to original (atomic operation on most systems)
                await fs.rename(tempPath, imagePath);
                
            } catch (writeError) {
                if (attempt < maxRetries && (writeError.code === 'EBUSY' || writeError.code === 'UNKNOWN' || writeError.code === 'EACCES')) {
                    console.log(`File write failed (attempt ${attempt}), retrying...`);
                    // Clean up temp file if it exists
                    try {
                        await fs.unlink(imagePath + '.tmp');
                    } catch (cleanupError) {
                        // Ignore cleanup errors
                    }
                    await new Promise(resolve => setTimeout(resolve, 300 * attempt)); // Longer delay for write operations
                    continue;
                }
                throw writeError;
            }
            
            // Verify the file was written correctly
            const finalStats = await fs.stat(imagePath);
            if (finalStats.size === 0) {
                throw new Error('File was corrupted during write operation');
            }
            
            // Additional delay to ensure file system stability
            await new Promise(resolve => setTimeout(resolve, 150));
            
            console.log(`Successfully rotated ${imagePath} by ${degrees} degrees`);
            return true;
            
        } catch (error) {
            lastError = error;
            console.error(`Rotation attempt ${attempt} failed for ${imagePath}:`, error.message);
            
            // If this isn't the last attempt and it's a retryable error, continue
            if (attempt < maxRetries && isRetryableError(error)) {
                const delay = 400 * attempt; // Exponential backoff
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // If we've exhausted retries or it's a non-retryable error, throw
            break;
        }
    }
    
    // If we get here, all retries failed
    console.error(`All ${maxRetries} rotation attempts failed for ${imagePath}`);
    
    // Provide more specific error messages
    if (lastError.code === 'ENOENT') {
        throw new Error('Image file not found');
    } else if (lastError.code === 'EACCES') {
        throw new Error('Permission denied - file may be locked by another process');
    } else if (lastError.code === 'EBUSY') {
        throw new Error('File is busy - please try again in a moment');
    } else if (lastError.code === 'UNKNOWN') {
        throw new Error('File access error - file may be locked or corrupted');
    } else {
        throw new Error(`Image processing failed after ${maxRetries} attempts: ${lastError.message}`);
    }
}

// Helper function to determine if an error is retryable
function isRetryableError(error) {
    const retryableCodes = ['EBUSY', 'UNKNOWN', 'EACCES', 'EAGAIN', 'EMFILE', 'ENFILE'];
    return retryableCodes.includes(error.code) || 
           error.message.includes('locked') || 
           error.message.includes('busy') ||
           error.message.includes('access');
}

// API Routes

// Get current directory
app.get('/api/directory', (req, res) => {
    res.json({
        success: true,
        directory: IMAGE_DIR
    });
});

// Set new directory
app.post('/api/directory', async (req, res) => {
    try {
        const { directory } = req.body;
        
        if (!directory) {
            return res.status(400).json({
                success: false,
                error: 'Directory path is required'
            });
        }
        
        // Check if directory exists
        try {
            await fs.access(directory);
            const stats = await fs.stat(directory);
            if (!stats.isDirectory()) {
                return res.status(400).json({
                    success: false,
                    error: 'Path is not a directory'
                });
            }
        } catch {
            return res.status(400).json({
                success: false,
                error: 'Directory does not exist or is not accessible'
            });
        }
        
        IMAGE_DIR = directory;
        console.log(`Directory changed to: ${IMAGE_DIR}`);
        
        res.json({
            success: true,
            directory: IMAGE_DIR,
            message: 'Directory updated successfully'
        });
    } catch (error) {
        console.error('Error setting directory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set directory'
        });
    }
});

// Get all images from the directory
app.get('/api/images', async (req, res) => {
    try {
        console.log('Scanning for images...');
        const images = await scanImagesRecursively(IMAGE_DIR);
        
        console.log(`Found ${images.length} images`);
        res.json({
            success: true,
            count: images.length,
            images: images,
            directory: IMAGE_DIR
        });
    } catch (error) {
        console.error('Error getting images:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to scan images'
        });
    }
});

// Get thumbnail for a specific image
app.get('/api/thumbnail/:imagePath(*)', async (req, res) => {
    try {
        const imagePath = req.params.imagePath;
        const fullPath = path.join(IMAGE_DIR, imagePath);
        
        // Check if file exists
        try {
            await fs.access(fullPath);
        } catch {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        const thumbnail = await generateThumbnail(fullPath);
        
        res.set({
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-cache' // Ensure fresh thumbnails after rotation
        });
        
        res.send(thumbnail);
    } catch (error) {
        console.error('Error generating thumbnail:', error);
        res.status(500).json({ error: 'Failed to generate thumbnail' });
    }
});

// Get preview (larger version) for a specific image
app.get('/api/preview/:imagePath(*)', async (req, res) => {
    try {
        const imagePath = req.params.imagePath;
        const fullPath = path.join(IMAGE_DIR, imagePath);
        
        // Check if file exists
        try {
            await fs.access(fullPath);
        } catch {
            return res.status(404).json({ error: 'Image not found' });
        }
        
        const preview = await generatePreview(fullPath);
        
        res.set({
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-cache' // Ensure fresh previews after rotation
        });
        
        res.send(preview);
    } catch (error) {
        console.error('Error generating preview:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

// Rotate image endpoint
app.post('/api/rotate', async (req, res) => {
    try {
        const { imagePath, degrees } = req.body;
        
        if (!imagePath || !degrees) {
            return res.status(400).json({
                success: false,
                error: 'Missing imagePath or degrees'
            });
        }
        
        const fullPath = path.join(IMAGE_DIR, imagePath);
        
        // Check if file exists
        try {
            await fs.access(fullPath);
        } catch {
            return res.status(404).json({
                success: false,
                error: 'Image not found'
            });
        }
        
        await rotateImage(fullPath, degrees);
        
        res.json({
            success: true,
            message: `Image rotated ${degrees} degrees`
        });
    } catch (error) {
        console.error('Error rotating image:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to rotate image'
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`\n🎨 Image Manipulator Server running at http://localhost:${PORT}`);
    console.log(`📁 Current directory: ${IMAGE_DIR}`);
    console.log('🚀 Ready for image rotation!\n');
});
