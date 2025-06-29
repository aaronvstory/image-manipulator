# 🔄 Image Manipulator - Professional Bulk Image Rotation Tool

[![GitHub stars](https://img.shields.io/github/stars/aaronvstory/image-manipulator?style=social)](https://github.com/aaronvstory/image-manipulator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A beautiful, efficient web application for bulk image rotation with thumbnail grid view, dynamic folder selection, and intelligent hover previews. Perfect for photographers, content creators, and anyone needing to quickly review and rotate hundreds of images with an intuitive interface.

![Image Manipulator Screenshot](https://via.placeholder.com/800x400/1e293b/e2e8f0?text=Image+Manipulator+Interface)

## ✨ Key Features

### 🎯 Smart Rotation Controls
- **Quick Rotation**: Click any thumbnail for instant 90° clockwise rotation
- **Precision Controls**: Dedicated CCW (-90°), Flip (180°), and CW (+90°) buttons
- **Rotation Throttling**: Intelligent 3-second cooldown prevents file corruption
- **Visual Feedback**: Instant success/error notifications with countdown timers

### 📁 Dynamic Folder Management
- **Direct Path Input**: Simply type or paste any folder path on your Windows system
- **Recursive Scanning**: Automatically finds all images in subdirectories
- **Instant Loading**: Quick scan and load with a single click
- **Real-time Validation**: Automatic path validation and error handling

### 🖼️ Advanced Image Preview
- **Smart Hover Preview**: 2-second hover triggers high-quality preview tooltip
- **Auto-Hide**: Preview disappears when you move mouse away (no clicking required!)
- **Optimized Loading**: Fast preview generation with loading indicators
- **Keyboard Support**: Press Escape to close any open previews

### 🎨 Beautiful Modern UI
- **Dark Theme**: Professional dark navy/blue gradient interface
- **Adjustable Grid**: Dynamic thumbnail sizing from 100px to 400px
- **Glassmorphism Effects**: Modern backdrop blur and transparency
- **Responsive Design**: Optimized for all screen sizes
- **Smooth Animations**: Polished hover effects and transitions

### ⚡ Performance & Reliability
- **High-Performance Processing**: Sharp image library for fast operations
- **Real-time Updates**: Changes immediately reflected in UI
- **Error Recovery**: Robust error handling with helpful messages
- **Memory Efficient**: Optimized for handling hundreds of images
- **File Safety**: Built-in protection against corruption

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Windows 10/11** - Optimized for Windows file systems

### Installation

```bash
# Clone the repository
git clone https://github.com/aaronvstory/image-manipulator.git
cd image-manipulator

# Install dependencies
npm install

# Start the application
npm start
```

The application will be available at **http://localhost:3000**

### Alternative: Download & Run
1. [Download ZIP](https://github.com/aaronvstory/image-manipulator/archive/refs/heads/main.zip)
2. Extract to your desired location
3. Open terminal in the extracted folder
4. Run `npm install` then `npm start`
5. Open http://localhost:3000 in your browser

## 🎮 How to Use

### 1. 📂 Select Your Images
- Enter your folder path directly in the input field (e.g., `C:\Photos\Vacation`)
- Click **"Load"** to scan for images in that directory
- Use **"Refresh"** to reload the current directory
- All subdirectories are automatically scanned for images

### 2. 🔧 Adjust Your View
- Use the **Grid Size** slider to resize thumbnails (100px - 400px)
- Perfect for different screen sizes and preferences
- Grid automatically adjusts to fit your screen

### 3. 🔄 Rotate Images
- **Quick Rotation**: Click any thumbnail for 90° CW rotation
- **Precision Controls**: Use the three control buttons:
  - 🔴 **Red**: Rotate 90° Counter-Clockwise
  - 🔵 **Blue**: Flip 180° (upside down)
  - 🟢 **Green**: Rotate 90° Clockwise
- **Smart Throttling**: Wait 3 seconds between rotations per image

### 4. 👁️ Preview Images
- **Hover** over any thumbnail for 2+ seconds
- High-quality preview appears as tooltip
- Move mouse away to hide instantly
- Press **Escape** to close all previews

## 🛠️ Technical Details

### Architecture
- **Backend**: Node.js with Express server
- **Image Processing**: Sharp (fastest Node.js image library)
- **Frontend**: Pure HTML5, CSS3, JavaScript (no frameworks!)
- **File Operations**: Direct file system manipulation with safety checks

### Supported Formats
- **JPEG** (.jpg, .jpeg) - Most common format
- **PNG** (.png) - Lossless compression
- **WebP** (.webp) - Modern web format
- **GIF** (.gif) - Animated/static
- **TIFF** (.tiff) - High quality
- **BMP** (.bmp) - Bitmap format

### Performance Features
- **Smart Caching**: Intelligent thumbnail cache with automatic invalidation
- **Lazy Loading**: Images load as you scroll
- **Memory Management**: Efficient handling of large image collections
- **Background Processing**: Non-blocking rotation operations
- **File Lock Prevention**: Built-in safeguards against corruption

## 📋 Project Structure

```
image-manipulator/
├── 📄 server.js              # Express server + image processing
├── 📁 public/                # Client-side application
│   ├── 🌐 index.html         # Main interface
│   ├── 🎨 style.css          # Modern UI styling
│   └── ⚡ script.js          # Client-side logic

├── 📦 package.json           # Dependencies
├── 📖 README.md              # This file
├── 📋 CHANGELOG.md           # Version history
└── 🚀 start-image-manipulator.bat # Windows quick start
```

## 🎨 UI Features Deep Dive

### Advanced Grid System
- **Dynamic Sizing**: CSS custom properties for real-time updates
- **Responsive Breakpoints**: Optimized layouts for different screens
- **Smart Scaling**: Buttons and text scale with grid size
- **Touch Friendly**: Works perfectly on touch devices

### Professional Controls
- **Uniform Button Design**: All rotation buttons same size and shape
- **Visual Hierarchy**: Clear distinction between actions
- **Hover Feedback**: Subtle glow effects without movement
- **Loading States**: Progress indicators during operations

### Error Handling
- **Rotation Throttling**: "Wait 3s" messages with countdown
- **File Access Errors**: Clear error messages with solutions
- **Network Issues**: Graceful degradation with retry options
- **Invalid Paths**: Helpful validation with suggestions

## 🔧 Configuration

### Environment Variables
```bash
# Set custom default directory
IMAGE_DIR=C:\Your\Custom\Path

# Set custom port (default: 3000)
PORT=8080
```

### Customization
- **Grid Size Range**: Modify CSS variables for different size limits
- **Hover Delay**: Adjust preview timing in script.js
- **Rotation Cooldown**: Change throttling duration as needed
- **Theme Colors**: Customize color palette in style.css

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the Repository**
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: `git commit -m 'Add amazing feature'`
4. **Push to Branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Setup
```bash
# Clone your fork
git clone https://github.com/yourusername/image-manipulator.git

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Sharp](https://sharp.pixelplumbing.com/)** - High-performance image processing
- **[Express.js](https://expressjs.com/)** - Fast, minimalist web framework
- **[Font Awesome](https://fontawesome.com/)** - Beautiful icons

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/aaronvstory/image-manipulator/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aaronvstory/image-manipulator/discussions)
- **Email**: support@example.com

---

**Built with ❤️ by developers, for content creators**

*Transform your image workflow with professional-grade rotation tools*
