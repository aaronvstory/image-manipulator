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
let IMAGE_DIR = process.env.IMAGE_DIR || './sample-images';

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
            .resize(800, 800, { 
                fit: 'inside', 
                withoutEnlargement: true 
            })
            .jpeg({ quality: 90 })
            .toBuffer();
        
        return preview;
    } catch (error) {
        console.error(`Error generating preview for ${imagePath}:`, error);
        throw error;
    }
}

// Rotate image and save back to original file
async function rotateImage(imagePath, degrees) {
    try {
        // Check if file is accessible before starting
        await fs.access(imagePath, fs.constants.R_OK | fs.constants.W_OK);
        
        // Read the original image
        const imageBuffer = await fs.readFile(imagePath);
        
        // Rotate the image
        const rotatedBuffer = await sharp(imageBuffer)
            .rotate(degrees)
            .toBuffer();
        
        // Write back to the original file with proper error handling
        await fs.writeFile(imagePath, rotatedBuffer);
        
        // Ensure file is fully written by checking its stats
        await fs.stat(imagePath);
        
        // Small delay to ensure file system has fully committed the write
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`Successfully rotated ${imagePath} by ${degrees} degrees`);
        return true;
    } catch (error) {
        console.error(`Error rotating image ${imagePath}:`, error);
        
        // Provide more specific error messages
        if (error.code === 'ENOENT') {
            throw new Error('Image file not found');
        } else if (error.code === 'EACCES') {
            throw new Error('Permission denied - file may be locked by another process');
        } else if (error.code === 'EBUSY') {
            throw new Error('File is busy - please try again in a moment');
        } else {
            throw new Error(`Image processing failed: ${error.message}`);
        }
    }
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
    console.log(`\n🎨 Image Rotator Server running at http://localhost:${PORT}`);
    console.log(`📁 Current directory: ${IMAGE_DIR}`);
    console.log('🚀 Ready for image rotation!\n');
});
