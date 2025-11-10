/**
 * OCR Results Viewer - View and edit OCR results
 */

class OCRViewer {
  constructor() {
    this.modal = null;
    this.currentImagePath = null;
    this.currentData = null;
    this.activeTab = 'formatted';
    this.hasChanges = false;
    this.init();
  }

  // HTML escape utility to prevent XSS
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  init() {
    this.modal = document.getElementById('ocrViewerModal');
    this.bindEvents();
  }

  bindEvents() {
    // Close button
    document.getElementById('ocrViewerClose').addEventListener('click', () => {
      this.close();
    });

    // Cancel button
    document.getElementById('ocrCancelBtn').addEventListener('click', () => {
      this.close();
    });

    // Save button
    document.getElementById('ocrSaveBtn').addEventListener('click', () => {
      this.saveChanges();
    });

    // Tab switching
    document.querySelectorAll('.ocr-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Track changes
    document.getElementById('ocrJsonEditor').addEventListener('input', () => {
      this.hasChanges = true;
    });

    document.getElementById('ocrRawEditor').addEventListener('input', () => {
      this.hasChanges = true;
    });

    // Click outside to close
    this.modal.querySelector('.ocr-viewer-overlay').addEventListener('click', () => {
      if (!this.hasChanges || confirm('You have unsaved changes. Close anyway?')) {
        this.close();
      }
    });
  }

  async open(imagePath) {
    this.currentImagePath = imagePath;
    this.hasChanges = false;

    // Extract base path for OCR files
    const ext = imagePath.match(/\.[^.]+$/)?.[0] || '';
    const basePath = imagePath.slice(0, -ext.length);
    const jsonPath = `${basePath}_ocr_results.json`;
    const txtPath = `${basePath}_ocr_results.txt`;

    try {
      // Fetch OCR results
      const response = await fetch(`/api/ocr-results?path=${encodeURIComponent(jsonPath)}`);
      if (!response.ok) {
        throw new Error('Failed to load OCR results');
      }

      this.currentData = await response.json();

      // Update filename display
      const filename = imagePath.split('/').pop();
      document.getElementById('ocrViewerFilename').textContent = filename;

      // Populate views
      this.populateFormattedView();
      this.populateJsonView();
      await this.populateRawView(txtPath);

      // Show modal
      this.modal.classList.remove('hidden');
      this.switchTab('formatted');

    } catch (error) {
      console.error('Error loading OCR results:', error);
      alert('Failed to load OCR results: ' + error.message);
    }
  }

  close() {
    if (this.hasChanges && !confirm('You have unsaved changes. Close anyway?')) {
      return;
    }

    this.modal.classList.add('hidden');
    this.currentImagePath = null;
    this.currentData = null;
    this.hasChanges = false;
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.ocr-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.ocr-tab-content').forEach(content => {
      const contentId = content.id;
      const isActive =
        (tabName === 'formatted' && contentId === 'ocrFormattedView') ||
        (tabName === 'json' && contentId === 'ocrJsonView') ||
        (tabName === 'raw' && contentId === 'ocrRawView');

      content.classList.toggle('active', isActive);
    });
  }

  populateFormattedView() {
    const container = document.getElementById('ocrFormattedData');
    const data = this.currentData;

    const html = `
      <button class="copy-all-btn" onclick="window.ocrViewer.copyAllData()">
        <i class="fas fa-copy"></i>
        Copy All Data
        <span class="copy-feedback" id="copyAllFeedback">Copied!</span>
      </button>

      <div class="field-group">
        <h3>Personal Information</h3>
        <div class="field">
          <div class="field-label">Name:</div>
          <div class="field-value">
            ${this.escapeHtml(this.formatName(data))}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(this.formatName(data)).replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Date of Birth:</div>
          <div class="field-value">
            ${this.escapeHtml(data.dateOfBirth) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.dateOfBirth || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Sex:</div>
          <div class="field-value">
            ${this.escapeHtml(data.sex) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.sex || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
      </div>

      <div class="field-group">
        <h3>License Information</h3>
        <div class="field">
          <div class="field-label">License Number:</div>
          <div class="field-value">
            ${this.escapeHtml(data.licenseNumber) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.licenseNumber || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">State:</div>
          <div class="field-value">
            ${this.escapeHtml(data.state) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.state || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Class:</div>
          <div class="field-value">
            ${this.escapeHtml(data.documentClass) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.documentClass || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Issue Date:</div>
          <div class="field-value">
            ${this.escapeHtml(data.issueDate) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.issueDate || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Expiration:</div>
          <div class="field-value">
            ${this.escapeHtml(data.expirationDate) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.expirationDate || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
      </div>

      <div class="field-group">
        <h3>Address</h3>
        <div class="field">
          <div class="field-label">Street:</div>
          <div class="field-value">
            ${this.escapeHtml(data.address) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.address || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">City:</div>
          <div class="field-value">
            ${this.escapeHtml(data.city) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.city || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Zip Code:</div>
          <div class="field-value">
            ${this.escapeHtml(data.zipCode) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.zipCode || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
      </div>

      <div class="field-group">
        <h3>Physical Description</h3>
        <div class="field">
          <div class="field-label">Height:</div>
          <div class="field-value">
            ${this.escapeHtml(data.height) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.height || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Weight:</div>
          <div class="field-value">
            ${this.escapeHtml(data.weight) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.weight || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Eye Color:</div>
          <div class="field-value">
            ${this.escapeHtml(data.eyeColor) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.eyeColor || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
        <div class="field">
          <div class="field-label">Hair Color:</div>
          <div class="field-value">
            ${this.escapeHtml(data.hairColor) || 'N/A'}
            <button class="field-copy-btn" onclick="window.ocrViewer.copyField('${this.escapeHtml(data.hairColor || '').replace(/'/g, "\\'")}')">
              <i class="fas fa-copy"></i> Copy
            </button>
          </div>
        </div>
      </div>

      <div class="field-group">
        <h3>Metadata</h3>
        <div class="field">
          <div class="field-label">Confidence:</div>
          <div class="field-value">${(data.confidence * 100).toFixed(0)}%</div>
        </div>
        <div class="field">
          <div class="field-label">Model Used:</div>
          <div class="field-value">${data.modelUsed || 'N/A'}</div>
        </div>
        <div class="field">
          <div class="field-label">Processed:</div>
          <div class="field-value">${new Date(data.processedAt).toLocaleString()}</div>
        </div>
        <div class="field">
          <div class="field-label">Cost:</div>
          <div class="field-value">$${data.cost?.toFixed(4) || '0.0000'}</div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  copyField(text) {
    if (!text || text === 'N/A') return;

    navigator.clipboard.writeText(text).then(() => {
      console.log('Field copied:', text);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  copyAllData() {
    const data = this.currentData;

    const text = `
PERSONAL INFORMATION
Name: ${this.formatName(data)}
Date of Birth: ${data.dateOfBirth || 'N/A'}
Sex: ${data.sex || 'N/A'}

LICENSE INFORMATION
License Number: ${data.licenseNumber || 'N/A'}
State: ${data.state || 'N/A'}
Class: ${data.documentClass || 'N/A'}
Issue Date: ${data.issueDate || 'N/A'}
Expiration: ${data.expirationDate || 'N/A'}

ADDRESS
Street: ${data.address || 'N/A'}
City: ${data.city || 'N/A'}
Zip Code: ${data.zipCode || 'N/A'}

PHYSICAL DESCRIPTION
Height: ${data.height || 'N/A'}
Weight: ${data.weight || 'N/A'}
Eye Color: ${data.eyeColor || 'N/A'}
Hair Color: ${data.hairColor || 'N/A'}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      const feedback = document.getElementById('copyAllFeedback');
      feedback.classList.add('show');
      setTimeout(() => feedback.classList.remove('show'), 2000);
    }).catch(err => {
      console.error('Failed to copy all data:', err);
      alert('Failed to copy to clipboard');
    });
  }

  populateJsonView() {
    const editor = document.getElementById('ocrJsonEditor');
    editor.value = JSON.stringify(this.currentData, null, 2);
  }

  async populateRawView(txtPath) {
    const editor = document.getElementById('ocrRawEditor');

    try {
      const response = await fetch(`/api/ocr-results?path=${encodeURIComponent(txtPath)}&raw=true`);
      if (!response.ok) {
        editor.value = 'Failed to load raw text file';
        return;
      }

      const text = await response.text();
      editor.value = text;

    } catch (error) {
      console.error('Error loading raw text:', error);
      editor.value = 'Error loading raw text file';
    }
  }

  formatName(data) {
    const parts = [];
    if (data.firstName) parts.push(data.firstName);
    if (data.middleName) parts.push(data.middleName);
    if (data.lastName) parts.push(data.lastName);
    return parts.join(' ') || 'N/A';
  }

  async saveChanges() {
    try {
      // Get the edited content based on active tab
      let updatedData;

      if (this.activeTab === 'json') {
        const jsonText = document.getElementById('ocrJsonEditor').value;
        try {
          updatedData = JSON.parse(jsonText);
        } catch (e) {
          alert('Invalid JSON format. Please fix the errors and try again.');
          return;
        }
      } else if (this.activeTab === 'raw') {
        // For raw text, we'll save it to the .txt file
        const rawText = document.getElementById('ocrRawEditor').value;

        const ext = this.currentImagePath.match(/\.[^.]+$/)?.[0] || '';
        const basePath = this.currentImagePath.slice(0, -ext.length);
        const txtPath = `${basePath}_ocr_results.txt`;

        const response = await fetch('/api/ocr-results/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: txtPath,
            content: rawText,
            type: 'txt'
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save changes');
        }

        alert('Changes saved successfully!');
        this.hasChanges = false;
        return;

      } else {
        alert('Formatted view is read-only. Switch to JSON or Raw Text tab to edit.');
        return;
      }

      // Save JSON changes
      const ext = this.currentImagePath.match(/\.[^.]+$/)?.[0] || '';
      const basePath = this.currentImagePath.slice(0, -ext.length);
      const jsonPath = `${basePath}_ocr_results.json`;

      const response = await fetch('/api/ocr-results/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: jsonPath,
          content: JSON.stringify(updatedData, null, 2),
          type: 'json'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      this.currentData = updatedData;
      this.populateFormattedView();
      this.hasChanges = false;

      alert('Changes saved successfully!');

    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes: ' + error.message);
    }
  }
}
