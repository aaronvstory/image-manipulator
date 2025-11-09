/**
 * OCR Provider - OpenRouter integration for vision-based OCR
 * Simplified version based on dl-organizer-v2's ProviderManager
 */

const OpenAI = require('openai');
const fs = require('fs').promises;

class OCRProvider {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.config = {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultModel: process.env.OCR_DEFAULT_MODEL || 'openai/gpt-4o-mini',
      timeout: parseInt(process.env.OCR_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.OCR_MAX_RETRIES || '3')
    };
  }

  /**
   * Initialize OpenRouter client
   */
  async initialize() {
    if (this.initialized) return;

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
      throw new Error(
        'OPENROUTER_API_KEY not configured. Please set it in .env file.\n' +
        'Get your API key from https://openrouter.ai/keys'
      );
    }

    console.log('🔧 OCRProvider: Initializing OpenRouter client...');
    console.log(`🌐 Base URL: ${this.config.baseURL}`);
    console.log(`📋 Default model: ${this.config.defaultModel}`);

    this.client = new OpenAI({
      baseURL: this.config.baseURL,
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://image-manipulator.local',
        'X-Title': 'Image Manipulator OCR Processing'
      }
    });

    this.initialized = true;
    console.log('✅ OCRProvider: Initialized successfully!');
  }

  /**
   * Build OCR prompt for driver's license extraction
   */
  buildDLPrompt() {
    return `You are an expert OCR system specializing in driver's license data extraction.

Analyze the provided image and extract ALL text and data fields you can identify.

CRITICAL REQUIREMENTS:
1. Extract EVERY visible text element, even if uncertain
2. For each field, provide your confidence level (0.0 to 1.0)
3. If a field is not visible or unclear, mark it as null
4. Include the complete raw text from the entire document
5. Identify if this is a FRONT side, BACK side, or SELFIE

DRIVER LICENSE FIELDS TO EXTRACT:
- firstName (first/given name)
- middleName (middle name or initial)
- lastName (last/family name)
- licenseNumber (DL/license number)
- dateOfBirth (format: YYYY-MM-DD)
- expirationDate (format: YYYY-MM-DD)
- issueDate (format: YYYY-MM-DD if visible)
- state (2-letter state code)
- address (street address)
- city
- zipCode
- sex (M/F/X)
- height (format: feet-inches or cm)
- weight (format: lbs or kg)
- eyeColor
- hairColor
- organDonor (yes/no/unknown)
- documentClass (license class: C, D, M, etc.)
- restrictions (vision, etc.)
- endorsements (motorcycle, etc.)

METADATA:
- cardSide (front/back/selfie/unknown)
- documentType (drivers_license/id_card/passport/selfie/unknown)
- confidence (overall 0.0-1.0)
- rawText (complete text from the document)

Return your response as a valid JSON object with ALL fields, even if null.

Example format:
{
  "firstName": "John",
  "middleName": "M",
  "lastName": "Doe",
  "licenseNumber": "D1234567",
  "dateOfBirth": "1990-01-15",
  "expirationDate": "2028-01-15",
  "issueDate": "2024-01-15",
  "state": "CA",
  "address": "123 Main St",
  "city": "Los Angeles",
  "zipCode": "90001",
  "sex": "M",
  "height": "6-00",
  "weight": "180",
  "eyeColor": "BRN",
  "hairColor": "BRN",
  "organDonor": "yes",
  "documentClass": "C",
  "restrictions": "NONE",
  "endorsements": "NONE",
  "cardSide": "front",
  "documentType": "drivers_license",
  "confidence": 0.95,
  "rawText": "DRIVER LICENSE\\nCALIFORNIA\\n..."
}`;
  }

  /**
   * Process image with OpenRouter vision API
   * @param {string} imagePath - Path to image file
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - OCR result
   */
  async processImage(imagePath, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`📸 OCRProvider: Processing image: ${imagePath}`);

    // Read and encode image
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    // Build prompt
    const prompt = options.customPrompt || this.buildDLPrompt();
    const modelName = options.model || this.config.defaultModel;

    console.log(`🤖 OCRProvider: Using model: ${modelName}`);

    const requestPayload = {
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const startTime = Date.now();

    try {
      console.log(`🚀 OCRProvider: Sending request to OpenRouter...`);

      const response = await this.client.chat.completions.create(requestPayload);
      const duration = Date.now() - startTime;

      const usage = response.usage;
      const responseContent = response.choices[0].message.content;

      console.log(`✅ OCRProvider: Received response in ${duration}ms`);
      console.log(`📊 Usage: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} tokens`);

      // Parse JSON response
      let ocrData;
      try {
        ocrData = JSON.parse(responseContent);
      } catch (error) {
        console.error('❌ OCRProvider: Failed to parse JSON response:', error);
        console.error('Raw response:', responseContent);
        throw new Error(`Failed to parse OCR response: ${error.message}`);
      }

      // Calculate cost (GPT-4o mini: $0.00015 per 1k tokens input, $0.0006 per 1k tokens output)
      const cost = ((usage.prompt_tokens / 1000) * 0.00015) + ((usage.completion_tokens / 1000) * 0.0006);

      console.log(`💰 OCRProvider: Estimated cost: $${cost.toFixed(6)}`);

      // Return structured result
      return {
        success: true,
        data: ocrData,
        metadata: {
          model: modelName,
          processingTime: duration,
          usage: usage,
          cost: cost,
          processedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ OCRProvider: Processing failed after ${duration}ms:`, error.message);

      return {
        success: false,
        error: error.message,
        metadata: {
          model: modelName,
          processingTime: duration,
          processedAt: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Parse and validate OCR result
   * @param {Object} ocrData - Raw OCR data
   * @returns {Object} - Validated and cleaned OCR result
   */
  parseResult(ocrData) {
    // Extract confidence
    const confidence = ocrData.confidence || 0.0;

    // Clean up the data
    const result = {
      // Personal information
      firstName: ocrData.firstName || null,
      middleName: ocrData.middleName || null,
      lastName: ocrData.lastName || null,
      dateOfBirth: ocrData.dateOfBirth || null,
      sex: ocrData.sex || null,

      // License information
      licenseNumber: ocrData.licenseNumber || null,
      state: ocrData.state || null,
      issueDate: ocrData.issueDate || null,
      expirationDate: ocrData.expirationDate || null,
      documentClass: ocrData.documentClass || null,

      // Address information
      address: ocrData.address || null,
      city: ocrData.city || null,
      zipCode: ocrData.zipCode || null,

      // Physical characteristics
      height: ocrData.height || null,
      weight: ocrData.weight || null,
      eyeColor: ocrData.eyeColor || null,
      hairColor: ocrData.hairColor || null,

      // Additional fields
      organDonor: ocrData.organDonor || null,
      restrictions: ocrData.restrictions || null,
      endorsements: ocrData.endorsements || null,

      // Metadata
      cardSide: ocrData.cardSide || 'unknown',
      documentType: ocrData.documentType || 'unknown',
      rawText: ocrData.rawText || '',
      confidence: confidence
    };

    return result;
  }
}

module.exports = {
  OCRProvider
};
