/**
 * Result Saver - Save OCR results as JSON and TXT files
 * Based on dl-organizer-v2's file-manager.js with retry logic
 */

const fs = require('fs').promises;
const path = require('path');

// Retry configuration (matching server.js rotation logic)
const MAX_RETRIES = 3;
const RETRY_DELAYS = [200, 400, 600]; // Exponential backoff in ms

/**
 * Check if error is retryable (Windows file locking issues)
 */
function isRetryableError(error) {
  const retryableCodes = ['EBUSY', 'EACCES', 'UNKNOWN'];
  return retryableCodes.includes(error.code);
}

/**
 * Save OCR results to JSON and TXT files
 * @param {string} imagePath - Path to the source image
 * @param {Object} ocrResult - OCR data to save
 * @param {Object} options - Save options
 * @returns {Promise<Object>} - { success, files: [{ type, path, size }] }
 */
async function saveOCRResults(imagePath, ocrResult, options = {}) {
  const settings = {
    saveJSON: options.saveJSON !== false, // Default true
    saveTXT: options.saveTXT !== false,   // Default true
    outputFormat: options.outputFormat || ['json', 'txt']
  };

  const results = {
    success: false,
    files: [],
    error: null
  };

  try {
    // Add metadata to OCR result
    const enhancedResult = {
      ...ocrResult,
      imagePath,
      savedAt: new Date().toISOString(),
      fileFormat: 'image-manipulator-v2.0'
    };

    // Save JSON file
    if (settings.saveJSON) {
      const jsonResult = await saveJSONResult(imagePath, enhancedResult);
      results.files.push(jsonResult);
    }

    // Save TXT file
    if (settings.saveTXT) {
      const txtResult = await saveTXTResult(imagePath, enhancedResult);
      results.files.push(txtResult);
    }

    results.success = true;
    return results;

  } catch (error) {
    results.error = error.message;
    throw error;
  }
}

/**
 * Save JSON result file with retry logic
 * @param {string} imagePath
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function saveJSONResult(imagePath, data) {
  const jsonPath = getResultFilename(imagePath, 'json');

  const jsonData = {
    ...data,
    fileVersion: '2.0',
    generatedBy: 'Image Manipulator Batch OCR'
  };

  const jsonContent = JSON.stringify(jsonData, null, 2);

  // Save with retry logic (matching server.js pattern)
  await saveFileWithRetry(jsonPath, jsonContent);

  return {
    type: 'json',
    path: jsonPath,
    size: jsonContent.length,
    created: new Date().toISOString()
  };
}

/**
 * Save TXT result file with retry logic
 * @param {string} imagePath
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function saveTXTResult(imagePath, data) {
  const txtPath = getResultFilename(imagePath, 'txt');
  const content = formatTXTContent(data);

  // Save with retry logic
  await saveFileWithRetry(txtPath, content);

  return {
    type: 'txt',
    path: txtPath,
    size: content.length,
    created: new Date().toISOString()
  };
}

/**
 * Save file with retry logic for Windows file locking
 * @param {string} filePath
 * @param {string} content
 */
async function saveFileWithRetry(filePath, content) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await fs.writeFile(filePath, content, 'utf8');
      return; // Success
    } catch (error) {
      lastError = error;

      if (isRetryableError(error) && attempt < MAX_RETRIES - 1) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        continue;
      }

      // Non-retryable error or max retries reached
      throw error;
    }
  }

  throw lastError;
}

/**
 * Format TXT content from OCR data
 * @param {Object} data - OCR result data
 * @returns {string}
 */
function formatTXTContent(data) {
  const timestamp = data.savedAt || new Date().toISOString();
  let content = '';

  // Header
  content += `OCR Analysis Results\n`;
  content += '='.repeat(60) + '\n';
  content += `Processed: ${timestamp}\n`;
  content += `Source Image: ${path.basename(data.imagePath || 'unknown')}\n`;
  content += `Model Used: ${data.modelUsed || 'Unknown'}\n`;
  content += `Confidence: ${Math.round((data.confidence || 0) * 100)}%\n`;
  content += `File Format: ${data.fileFormat || 'Unknown'}\n\n`;

  // OCR Text Results
  content += 'EXTRACTED TEXT\n';
  content += '-'.repeat(30) + '\n';

  if (data.text) {
    content += `${data.text}\n\n`;
  }

  // Structured Data (if available)
  if (data.firstName || data.lastName || data.licenseNumber) {
    content += 'STRUCTURED DATA\n';
    content += '-'.repeat(30) + '\n';
    if (data.firstName) content += `First Name: ${data.firstName}\n`;
    if (data.middleName) content += `Middle Name: ${data.middleName}\n`;
    if (data.lastName) content += `Last Name: ${data.lastName}\n`;
    if (data.licenseNumber) content += `License Number: ${data.licenseNumber}\n`;
    if (data.dateOfBirth) content += `Date of Birth: ${data.dateOfBirth}\n`;
    if (data.expirationDate) content += `Expiration: ${data.expirationDate}\n`;
    if (data.state) content += `State: ${data.state}\n`;
    content += '\n';
  }

  // Raw OCR Data (if available)
  if (data.rawText) {
    content += 'RAW OCR OUTPUT\n';
    content += '-'.repeat(30) + '\n';
    content += `${data.rawText}\n\n`;
  }

  // Footer
  content += '='.repeat(60) + '\n';
  content += `Generated by Image Manipulator v2.0\n`;

  return content;
}

/**
 * Generate result filename
 * @param {string} imagePath
 * @param {string} format - 'json' | 'txt'
 * @returns {string}
 */
function getResultFilename(imagePath, format) {
  const ext = path.extname(imagePath);
  const basePath = imagePath.slice(0, -ext.length);

  if (format === 'json') {
    return `${basePath}_ocr_results.json`;
  } else if (format === 'txt') {
    return `${basePath}_ocr_results.txt`;
  }

  throw new Error(`Unsupported format: ${format}`);
}

/**
 * Read existing JSON result
 * @param {string} imagePath
 * @returns {Promise<Object|null>}
 */
async function readJSONResult(imagePath) {
  const jsonPath = getResultFilename(imagePath, 'json');

  try {
    const content = await fs.readFile(jsonPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

module.exports = {
  saveOCRResults,
  saveJSONResult,
  saveTXTResult,
  getResultFilename,
  readJSONResult,
  formatTXTContent
};
