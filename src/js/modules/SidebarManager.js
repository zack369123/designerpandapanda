/**
 * SidebarManager - Tab-based sidebar (Lumise-style)
 * Handles left sidebar with templates, cliparts, text, shapes, uploads, layers
 */

import { units } from '../utils/Units.js';

export class SidebarManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.events = window.designerEvents;
        this.currentTab = 'templates';
        this.userUploads = [];
        this.units = units;

        this.init();
    }

    /**
     * Initialize sidebar
     */
    init() {
        this.sidebar = document.getElementById('left-sidebar');
        this.tabButtons = this.sidebar.querySelectorAll('.tab-btn');
        this.tabPanels = this.sidebar.querySelectorAll('.tab-panel');

        this.setupTabNavigation();
        this.setupTextPanel();
        this.setupShapesPanel();
        this.setupUploadsPanel();
        this.setupPropertiesPanel();

        // Listen for tab show events
        this.events.on('sidebar:showTab', (tabId) => {
            this.showTab(tabId);
        });
    }

    /**
     * Set up tab navigation
     */
    setupTabNavigation() {
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.showTab(tabId);
            });
        });
    }

    /**
     * Show specific tab
     */
    showTab(tabId) {
        this.currentTab = tabId;

        // Update tab buttons
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update panels
        this.tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabId);
        });

        this.events.emit('sidebar:tabChanged', tabId);
    }

    /**
     * Set up text panel
     */
    setupTextPanel() {
        const addTextBtn = document.getElementById('add-text-btn');
        const textInput = document.getElementById('new-text-input');

        if (addTextBtn && textInput) {
            addTextBtn.addEventListener('click', () => {
                const text = textInput.value.trim() || 'Sample Text';
                this.canvas.addText(text);
                textInput.value = '';
            });

            // Also add on Enter key
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    addTextBtn.click();
                }
            });
        }

        // Text presets
        const presets = this.sidebar.querySelectorAll('.text-preset');
        presets.forEach(preset => {
            preset.addEventListener('click', () => {
                const presetType = preset.dataset.preset;
                this.addTextPreset(presetType);
            });
        });
    }

    /**
     * Add text preset
     */
    addTextPreset(type) {
        const presets = {
            heading: {
                text: 'Heading',
                fontSize: 48,
                fontWeight: 'bold',
                fontFamily: 'Arial'
            },
            subheading: {
                text: 'Subheading',
                fontSize: 32,
                fontWeight: '500',
                fontFamily: 'Arial'
            },
            body: {
                text: 'Body text goes here',
                fontSize: 18,
                fontWeight: 'normal',
                fontFamily: 'Arial'
            },
            curved: {
                text: 'Curved Text',
                fontSize: 24,
                fontStyle: 'italic',
                fontFamily: 'Georgia'
            }
        };

        const preset = presets[type];
        if (preset) {
            this.canvas.addText(preset.text, preset);
        }
    }

    /**
     * Set up shapes panel
     */
    setupShapesPanel() {
        const shapeButtons = this.sidebar.querySelectorAll('.shape-btn');
        shapeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const shape = btn.dataset.shape;
                this.canvas.addShape(shape);
            });
        });

        // Color presets
        const colorPresets = this.sidebar.querySelectorAll('.color-preset');
        colorPresets.forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                const obj = this.canvas.getSelected();
                if (obj) {
                    obj.set('fill', color);
                    this.canvas.render();
                    this.events.emit('history:save');
                }
            });
        });
    }

    /**
     * Set up uploads panel
     */
    setupUploadsPanel() {
        const dropzone = document.getElementById('upload-dropzone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = dropzone?.querySelector('.btn');

        if (dropzone) {
            // Click to browse
            browseBtn?.addEventListener('click', () => {
                fileInput?.click();
            });

            // File input change
            fileInput?.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });

            // Drag and drop
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('drag-over');
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('drag-over');
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('drag-over');
                this.handleFiles(e.dataTransfer.files);
            });
        }

        // Global image upload input (for replace image)
        const globalUpload = document.getElementById('image-upload-input');
        globalUpload?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.replaceSelectedImage(file);
            }
        });
    }

    /**
     * Handle uploaded files
     */
    handleFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                alert('Please upload image files only');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;

                // Store in uploads
                this.userUploads.push({
                    id: Date.now(),
                    name: file.name,
                    dataUrl: dataUrl
                });

                // Add to uploads grid
                this.renderUploads();

                // Also add to canvas
                this.canvas.addImage(dataUrl);
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Render user uploads in grid
     */
    renderUploads() {
        const grid = document.getElementById('uploads-grid');
        if (!grid) return;

        grid.innerHTML = this.userUploads.map(upload => `
            <div class="grid-item" data-upload-id="${upload.id}">
                <div class="item-thumb">
                    <img src="${upload.dataUrl}" alt="${upload.name}">
                </div>
                <span>${this.truncate(upload.name, 12)}</span>
            </div>
        `).join('');

        // Add click handlers
        grid.querySelectorAll('.grid-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.uploadId);
                const upload = this.userUploads.find(u => u.id === id);
                if (upload) {
                    this.canvas.addImage(upload.dataUrl);
                }
            });
        });
    }

    /**
     * Replace selected image
     * Preserves original high-res source for print quality
     */
    replaceSelectedImage(file) {
        const obj = this.canvas.getSelected();
        if (!obj || obj.type !== 'image') return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;

            // Load image to get original dimensions
            const tempImg = new Image();
            tempImg.onload = () => {
                // Store original source and dimensions BEFORE Fabric scales it
                obj._originalSrc = dataUrl;
                obj._originalWidth = tempImg.naturalWidth;
                obj._originalHeight = tempImg.naturalHeight;

                obj.setSrc(dataUrl, () => {
                    this.canvas.render();
                    this.events.emit('history:save');
                    console.log(`Image replaced: ${tempImg.naturalWidth}x${tempImg.naturalHeight}px original`);
                });
            };
            tempImg.src = dataUrl;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Set up properties panel (right sidebar)
     */
    setupPropertiesPanel() {
        const rightSidebar = document.getElementById('right-sidebar');

        // Listen for property updates
        this.events.on('properties:update', (obj) => {
            this.updatePropertiesPanel(obj);
        });

        // Position inputs
        const propX = document.getElementById('prop-x');
        const propY = document.getElementById('prop-y');
        const propWidth = document.getElementById('prop-width');
        const propHeight = document.getElementById('prop-height');
        const propRotation = document.getElementById('prop-rotation');
        const propOpacity = document.getElementById('prop-opacity');

        // Update position (input is in inches, convert to pixels using print area DPI)
        [propX, propY].forEach(input => {
            input?.addEventListener('change', () => {
                const obj = this.canvas.getSelected();
                if (obj) {
                    const dpi = this._currentPrintAreaDPI || 72;
                    const bounds = this._currentPrintAreaBounds;

                    // Convert inches to pixels
                    let newLeft = parseFloat(propX.value) * dpi;
                    let newTop = parseFloat(propY.value) * dpi;

                    // Add print area offset if available
                    if (bounds) {
                        newLeft += bounds.left;
                        newTop += bounds.top;
                    }

                    obj.set({ left: newLeft, top: newTop });
                    this.canvas.render();
                    this.events.emit('history:save');
                }
            });
        });

        // Update size (input is in inches, convert to pixels using print area DPI)
        [propWidth, propHeight].forEach(input => {
            input?.addEventListener('change', () => {
                const obj = this.canvas.getSelected();
                if (obj) {
                    const dpi = this._currentPrintAreaDPI || 72;
                    const lockRatio = document.getElementById('prop-lock-ratio')?.checked;
                    const newWidthInches = parseFloat(propWidth.value);
                    const newHeightInches = parseFloat(propHeight.value);

                    if (lockRatio && input === propWidth) {
                        const ratio = obj.height / obj.width;
                        propHeight.value = (newWidthInches * ratio).toFixed(2);
                    } else if (lockRatio && input === propHeight) {
                        const ratio = obj.width / obj.height;
                        propWidth.value = (newHeightInches * ratio).toFixed(2);
                    }

                    // Convert inches to pixels using print area DPI
                    const newWidthPx = parseFloat(propWidth.value) * dpi;
                    const newHeightPx = parseFloat(propHeight.value) * dpi;

                    obj.set({
                        scaleX: newWidthPx / obj.width,
                        scaleY: newHeightPx / obj.height
                    });
                    this.canvas.render();
                    this.events.emit('history:save');
                }
            });
        });

        // Update rotation
        propRotation?.addEventListener('change', () => {
            const obj = this.canvas.getSelected();
            if (obj) {
                obj.set('angle', parseFloat(propRotation.value));
                this.canvas.render();
                this.events.emit('history:save');
            }
        });

        // Update opacity
        propOpacity?.addEventListener('input', (e) => {
            const obj = this.canvas.getSelected();
            if (obj) {
                obj.set('opacity', parseInt(e.target.value) / 100);
                document.getElementById('prop-opacity-val').textContent = `${e.target.value}%`;
                this.canvas.render();
            }
        });
        propOpacity?.addEventListener('change', () => {
            this.events.emit('history:save');
        });

        // Action buttons
        rightSidebar.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handlePropertyAction(action);
            });
        });
    }

    /**
     * Update properties panel with object data
     * Uses print area DPI for accurate inch conversion
     */
    updatePropertiesPanel(obj) {
        const nonePanel = document.querySelector('[data-panel="none"]');
        const objectPanel = document.querySelector('[data-panel="object"]');

        if (!obj) {
            nonePanel?.classList.remove('hidden');
            objectPanel?.classList.add('hidden');
            return;
        }

        nonePanel?.classList.add('hidden');
        objectPanel?.classList.remove('hidden');

        // Get print area DPI for accurate conversion
        // If print area is 200px wide and represents 16", then DPI = 200/16 = 12.5
        const printAreaDPI = this.canvas.printAreaDPI || 72;

        // Convert pixels to inches using print area's actual scale
        const pxToInches = (px) => px / printAreaDPI;
        const inchesToPx = (inches) => inches * printAreaDPI;

        // Calculate object dimensions in pixels
        const widthPx = obj.width * obj.scaleX;
        const heightPx = obj.height * obj.scaleY;

        // Get position relative to print area for more intuitive values
        const bounds = this.canvas.getPrintAreaBounds();
        let posX = obj.left;
        let posY = obj.top;

        // If we have print area bounds, show position relative to print area
        if (bounds) {
            posX = obj.left - bounds.left;
            posY = obj.top - bounds.top;
        }

        document.getElementById('prop-x').value = pxToInches(posX).toFixed(2);
        document.getElementById('prop-y').value = pxToInches(posY).toFixed(2);
        document.getElementById('prop-width').value = pxToInches(widthPx).toFixed(2);
        document.getElementById('prop-height').value = pxToInches(heightPx).toFixed(2);
        document.getElementById('prop-rotation').value = Math.round(obj.angle);
        document.getElementById('prop-opacity').value = Math.round(obj.opacity * 100);
        document.getElementById('prop-opacity-val').textContent = `${Math.round(obj.opacity * 100)}%`;

        // Store current DPI for input handlers
        this._currentPrintAreaDPI = printAreaDPI;
        this._currentPrintAreaBounds = bounds;
    }

    /**
     * Handle property panel actions
     */
    handlePropertyAction(action) {
        switch (action) {
            case 'duplicate':
                this.canvas.duplicateSelected();
                break;
            case 'delete':
                this.canvas.deleteSelected();
                break;
            case 'lock':
                const obj = this.canvas.getSelected();
                if (obj) {
                    const isLocked = obj.lockMovementX;
                    obj.set({
                        lockMovementX: !isLocked,
                        lockMovementY: !isLocked,
                        lockRotation: !isLocked,
                        lockScalingX: !isLocked,
                        lockScalingY: !isLocked,
                        hasControls: isLocked
                    });
                    this.canvas.render();
                }
                break;
            case 'bring-front':
                this.canvas.bringToFront();
                break;
            case 'send-back':
                this.canvas.sendToBack();
                break;
            case 'trim-transparency':
                this.trimTransparency();
                break;
            case 'max-size':
                this.maxSize();
                break;
        }
    }

    /**
     * Remove transparent pixels around an image (like Photoshop's trim)
     */
    trimTransparency() {
        const obj = this.canvas.getSelected();
        if (!obj || obj.type !== 'image') {
            alert('Please select an image first');
            return;
        }

        // Get the image element
        const imgElement = obj._element || obj.getElement();
        if (!imgElement) return;

        // Create offscreen canvas to analyze pixels
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        tempCanvas.width = imgElement.naturalWidth || imgElement.width;
        tempCanvas.height = imgElement.naturalHeight || imgElement.height;

        // Draw image
        ctx.drawImage(imgElement, 0, 0);

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const pixels = imageData.data;

        // Find bounds of non-transparent pixels
        let minX = tempCanvas.width, minY = tempCanvas.height;
        let maxX = 0, maxY = 0;

        for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
                const alpha = pixels[(y * tempCanvas.width + x) * 4 + 3];
                if (alpha > 10) { // Threshold for "not transparent"
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        // Check if we found any non-transparent pixels
        if (maxX <= minX || maxY <= minY) {
            alert('Image appears to be fully transparent');
            return;
        }

        // Calculate new dimensions
        const cropWidth = maxX - minX + 1;
        const cropHeight = maxY - minY + 1;

        console.log(`Trimming: ${tempCanvas.width}x${tempCanvas.height} → ${cropWidth}x${cropHeight}`);

        // Create cropped canvas
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = cropHeight;
        const croppedCtx = croppedCanvas.getContext('2d');

        // Draw cropped region
        croppedCtx.drawImage(
            imgElement,
            minX, minY, cropWidth, cropHeight,  // Source rectangle
            0, 0, cropWidth, cropHeight          // Destination rectangle
        );

        // Get current center position
        const centerX = obj.left;
        const centerY = obj.top;
        const currentScale = obj.scaleX;

        // Convert to data URL and update the image
        const croppedDataUrl = croppedCanvas.toDataURL('image/png');

        // Update the fabric image with cropped version
        obj.setSrc(croppedDataUrl, () => {
            // Restore position (center) and scale
            obj.set({
                left: centerX,
                top: centerY,
                scaleX: currentScale,
                scaleY: currentScale,
                // Update original dimensions for high-DPI export
                _originalSrc: croppedDataUrl,
                _originalWidth: cropWidth,
                _originalHeight: cropHeight
            });
            obj.setCoords();
            this.canvas.render();
            this.events.emit('history:save');
            this.events.emit('properties:update', obj);
        });
    }

    /**
     * Scale image to maximum size within print area while maintaining aspect ratio
     */
    maxSize() {
        const obj = this.canvas.getSelected();
        if (!obj) {
            alert('Please select an object first');
            return;
        }

        // Get print area bounds
        const bounds = this.canvas.getPrintAreaBounds();
        if (!bounds) {
            alert('No print area defined');
            return;
        }

        // Get current object dimensions (unscaled)
        const objWidth = obj.width;
        const objHeight = obj.height;
        const aspectRatio = objWidth / objHeight;

        // Calculate scale to fit within print area
        const scaleX = bounds.width / objWidth;
        const scaleY = bounds.height / objHeight;

        // Use the smaller scale to maintain aspect ratio and fit within bounds
        const newScale = Math.min(scaleX, scaleY);

        // Calculate new dimensions
        const newWidth = objWidth * newScale;
        const newHeight = objHeight * newScale;

        // Center in print area
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;

        obj.set({
            scaleX: newScale,
            scaleY: newScale,
            left: centerX,
            top: centerY,
            originX: 'center',
            originY: 'center'
        });

        obj.setCoords();
        this.canvas.render();
        this.events.emit('history:save');
        this.events.emit('properties:update', obj);

        console.log(`Max size: scaled to ${(newWidth / bounds.width * 100).toFixed(0)}% of print area width, ${(newHeight / bounds.height * 100).toFixed(0)}% of height`);
    }

    /**
     * Truncate string
     */
    truncate(str, length) {
        return str.length > length ? str.substring(0, length) + '...' : str;
    }
}
