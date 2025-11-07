/**
 * Skip Detector - Check if image already has OCR results
 * This functionality is MISSING from dl-organizer-v2 (config exists but not implemented)
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Check if an image should be skipped (already processed)
 * @param {string} imagePath - Path to the image file
 * @param {Object} options - Processing options
 * @param {string} options.overwrite - 'skip' | 'overwrite' | 'suffix'
 * @returns {Promise<boolean>} - True if should skip
 */
async function shouldSkipImage(imagePath, options = {}) {
  const overwriteMode = options.overwrite || 'skip';

  // If overwrite mode is not 'skip', always process
  if (overwriteMode !== 'skip') {
    return false;
  }

  // Check if result file exists
  const resultPath = getResultPath(imagePath, 'json');

  try {
    await fs.access(resultPath);
    // File exists, skip processing
    return true;
  } catch (error) {
    // File doesn't exist or can't access, process it
    return false;
  }
}

/**
 * Get the result file path for an image
 * @param {string} imagePath - Path to the image file
 * @param {string} format - 'json' | 'txt'
 * @returns {string} - Path to result file
 */
function getResultPath(imagePath, format = 'json') {
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
 * Check if result files exist for an image
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<Object>} - { json: boolean, txt: boolean }
 */
async function checkResultFiles(imagePath) {
  const jsonPath = getResultPath(imagePath, 'json');
  const txtPath = getResultPath(imagePath, 'txt');

  const results = {
    json: false,
    txt: false,
    jsonPath,
    txtPath
  };

  try {
    await fs.access(jsonPath);
    results.json = true;
  } catch (error) {
    // JSON file doesn't exist
  }

  try {
    await fs.access(txtPath);
    results.txt = true;
  } catch (error) {
    // TXT file doesn't exist
  }

  return results;
}

/**
 * Read existing OCR results if they exist
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<Object|null>} - OCR results or null if doesn't exist
 */
async function readExistingResults(imagePath) {
  const jsonPath = getResultPath(imagePath, 'json');

  try {
    const data = await fs.readFile(jsonPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

module.exports = {
  shouldSkipImage,
  getResultPath,
  checkResultFiles,
  readExistingResults
};
