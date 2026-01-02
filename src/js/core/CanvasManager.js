/**
 * CanvasManager - Fabric.js canvas wrapper with custom controls
 * Handles all canvas operations, object manipulation, and custom rendering
 */

export class CanvasManager {
    constructor(options = {}) {
        this.options = {
            canvasId: 'design-canvas',
            width: 600,
            height: 600,
            backgroundColor: '#ffffff',
            selectionColor: 'rgba(63, 199, 186, 0.3)',
            selectionBorderColor: '#3fc7ba',
            cornerColor: '#3fc7ba',
            cornerSize: 10,
            transparentCorners: false,
            dpi: 72,  // Screen DPI
            ...options
        };

        this.events = window.designerEvents;
        this.clipboard = null;
        this.zoom = 1;

        // Product/Print Area state
        this.productImage = null;       // Background product image
        this.printAreaRect = null;      // Visual print area indicator
        this.printAreaClipPath = null;  // Clipping path for designs
        this.currentView = null;        // Current product view data
        this.printAreaBounds = null;    // Calculated bounds {left, top, width, height}

        this.init();
    }

    /**
     * Initialize Fabric.js canvas
     */
    init() {
        // Create Fabric canvas
        this.fabricCanvas = new fabric.Canvas(this.options.canvasId, {
            width: this.options.width,
            height: this.options.height,
            backgroundColor: this.options.backgroundColor,
            selection: true,
            selectionColor: this.options.selectionColor,
            selectionBorderColor: this.options.selectionBorderColor,
            preserveObjectStacking: true
        });

        // Set default object controls style
        this.setControlsStyle();

        // Add custom controls rendering
        this.addCustomControls();

        // Set up canvas event listeners
        this.setupCanvasEvents();

        // Update zoom display
        this.updateZoomDisplay();
    }

    /**
     * Set default control styles for all objects
     */
    setControlsStyle() {
        fabric.Object.prototype.set({
            cornerColor: this.options.cornerColor,
            cornerSize: this.options.cornerSize,
            cornerStyle: 'circle',
            transparentCorners: this.options.transparentCorners,
            borderColor: this.options.selectionBorderColor,
            borderScaleFactor: 2,
            padding: 5
        });
    }

    /**
     * Add custom control rendering (Lumise-style)
     */
    addCustomControls() {
        // Custom rotation icon
        const rotateIcon = new Image();
        rotateIcon.src = 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3fc7ba">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
        `);

        // Custom delete icon
        const deleteIcon = new Image();
        deleteIcon.src = 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e74c3c">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
        `);

        // Override control rendering for custom icons
        fabric.Object.prototype.controls.deleteControl = new fabric.Control({
            x: 0.5,
            y: -0.5,
            offsetX: 16,
            offsetY: -16,
            cursorStyle: 'pointer',
            mouseUpHandler: (eventData, transform) => {
                const target = transform.target;
                this.fabricCanvas.remove(target);
                this.fabricCanvas.requestRenderAll();
                this.events.emit('object:deleted', target);
                return true;
            },
            render: (ctx, left, top, styleOverride, fabricObject) => {
                const size = 24;
                ctx.save();
                ctx.translate(left, top);
                ctx.drawImage(deleteIcon, -size / 2, -size / 2, size, size);
                ctx.restore();
            }
        });

        // Rotation control with custom icon
        fabric.Object.prototype.controls.mtr = new fabric.Control({
            x: 0,
            y: -0.5,
            offsetY: -30,
            cursorStyle: 'crosshair',
            actionHandler: fabric.controlsUtils.rotationWithSnapping,
            actionName: 'rotate',
            render: (ctx, left, top, styleOverride, fabricObject) => {
                const size = 24;
                ctx.save();
                ctx.translate(left, top);
                ctx.drawImage(rotateIcon, -size / 2, -size / 2, size, size);
                ctx.restore();
            }
        });
    }

    /**
     * Set up canvas event listeners
     */
    setupCanvasEvents() {
        // Object selected
        this.fabricCanvas.on('selection:created', (e) => {
            this.onSelectionChanged(e.selected);
        });

        this.fabricCanvas.on('selection:updated', (e) => {
            this.onSelectionChanged(e.selected);
        });

        // Object deselected
        this.fabricCanvas.on('selection:cleared', () => {
            this.onSelectionChanged([]);
        });

        // Object modified (moved, scaled, rotated) - save to history after change
        this.fabricCanvas.on('object:modified', (e) => {
            this.events.emit('object:modified', e.target);
            this.events.emit('history:save');
            this.events.emit('properties:update', e.target);
        });

        // Object scaling - update properties panel in real-time
        this.fabricCanvas.on('object:scaling', (e) => {
            this.events.emit('properties:update', e.target);
        });

        // Object moving - update properties panel in real-time
        // NOTE: Only emitting event here, not modifying position (which causes jitter)
        this.fabricCanvas.on('object:moving', (e) => {
            this.events.emit('properties:update', e.target);
        });

        // Object rotating - snap to 45 degree angles (like Lumise) + update properties
        this.fabricCanvas.on('object:rotating', (e) => {
            const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
            snapAngles.forEach(angle => {
                if (Math.abs(e.target.angle - angle) < 5) {
                    e.target.angle = angle;
                }
            });
            this.events.emit('properties:update', e.target);
        });

        // Object added
        this.fabricCanvas.on('object:added', (e) => {
            this.events.emit('object:added', e.target);
            this.events.emit('layers:update');
        });

        // Object removed
        this.fabricCanvas.on('object:removed', (e) => {
            this.events.emit('object:removed', e.target);
            this.events.emit('layers:update');
        });
    }

    /**
     * Handle selection change
     */
    onSelectionChanged(selected) {
        let context = 'default';

        if (selected.length === 0) {
            context = 'default';
        } else if (selected.length > 1) {
            context = 'multiple';
        } else {
            const obj = selected[0];
            if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                context = 'text';
            } else if (obj.type === 'image') {
                context = 'image';
            } else if (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'triangle' || obj.type === 'polygon' || obj.type === 'path') {
                context = 'shape';
            }
        }

        this.events.emit('selection:changed', { objects: selected, context });
        this.events.emit('toolbar:context', context);
        this.events.emit('properties:update', selected[0] || null);
    }

    // =========================================================================
    // Object Creation Methods
    // =========================================================================

    /**
     * Add text to canvas
     */
    addText(text = 'Sample Text', options = {}) {
        // Center in print area if available, otherwise canvas center
        const center = this.getPrintAreaCenter();

        const textObj = new fabric.IText(text, {
            left: center.x,
            top: center.y,
            originX: 'center',
            originY: 'center',
            fontFamily: 'Arial',
            fontSize: 24,
            fill: '#000000',
            ...options
        });

        // Apply clipping to constrain within print area
        this.applyClipPathToObject(textObj);

        this.fabricCanvas.add(textObj);
        this.fabricCanvas.setActiveObject(textObj);
        this.events.emit('history:save');
        return textObj;
    }

    /**
     * Add image to canvas
     * IMPORTANT: Stores original high-res source for print-quality export
     */
    addImage(url, options = {}) {
        return new Promise((resolve, reject) => {
            // First, load the image to get original dimensions
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            tempImg.onload = () => {
                // Store original dimensions BEFORE any scaling
                const originalWidth = tempImg.naturalWidth;
                const originalHeight = tempImg.naturalHeight;

                fabric.Image.fromURL(url, (img) => {
                    if (!img) {
                        reject(new Error('Failed to load image'));
                        return;
                    }

                    // Store original source and dimensions for high-DPI export
                    img.set({
                        _originalSrc: url,
                        _originalWidth: originalWidth,
                        _originalHeight: originalHeight
                    });

                    // Scale image to fit print area if too large (for display only)
                    const bounds = this.getPrintAreaBounds();
                    const maxWidth = bounds ? bounds.width * 0.8 : this.options.width * 0.8;
                    const maxHeight = bounds ? bounds.height * 0.8 : this.options.height * 0.8;

                    if (img.width > maxWidth || img.height > maxHeight) {
                        const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                        img.scale(scale);
                    }

                    // Center in print area if available
                    const center = this.getPrintAreaCenter();

                    img.set({
                        left: center.x,
                        top: center.y,
                        originX: 'center',
                        originY: 'center',
                        ...options
                    });

                    // Apply clipping to constrain within print area
                    this.applyClipPathToObject(img);

                    this.fabricCanvas.add(img);
                    this.fabricCanvas.setActiveObject(img);
                    this.events.emit('history:save');

                    console.log(`Image added: ${originalWidth}x${originalHeight}px original, displayed at ${Math.round(img.width * img.scaleX)}x${Math.round(img.height * img.scaleY)}px`);
                    resolve(img);
                }, { crossOrigin: 'anonymous' });
            };
            tempImg.onerror = () => reject(new Error('Failed to load image'));
            tempImg.src = url;
        });
    }

    /**
     * Add shape to canvas
     */
    addShape(type, options = {}) {
        // Center in print area if available
        const center = this.getPrintAreaCenter();

        let shape;
        const defaults = {
            left: center.x,
            top: center.y,
            originX: 'center',
            originY: 'center',
            fill: '#3fc7ba',
            stroke: '#000000',
            strokeWidth: 0,
            ...options
        };

        switch (type) {
            case 'rect':
                shape = new fabric.Rect({
                    width: 100,
                    height: 100,
                    ...defaults
                });
                break;

            case 'circle':
                shape = new fabric.Circle({
                    radius: 50,
                    ...defaults
                });
                break;

            case 'triangle':
                shape = new fabric.Triangle({
                    width: 100,
                    height: 100,
                    ...defaults
                });
                break;

            case 'star':
                shape = this.createStar(5, 50, 25, defaults);
                break;

            case 'heart':
                shape = this.createHeart(defaults);
                break;

            case 'polygon':
                shape = this.createPolygon(6, 50, defaults);
                break;

            case 'line':
                shape = new fabric.Line([0, 0, 100, 0], {
                    ...defaults,
                    stroke: defaults.fill,
                    strokeWidth: 3
                });
                break;

            case 'arrow':
                shape = this.createArrow(defaults);
                break;

            default:
                shape = new fabric.Rect({
                    width: 100,
                    height: 100,
                    ...defaults
                });
        }

        // Apply clipping to constrain within print area
        this.applyClipPathToObject(shape);

        this.fabricCanvas.add(shape);
        this.fabricCanvas.setActiveObject(shape);
        this.events.emit('history:save');
        return shape;
    }

    /**
     * Create star shape
     */
    createStar(points, outerRadius, innerRadius, options) {
        const path = [];
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / points - Math.PI / 2;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            path.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
        }
        path.push('Z');
        return new fabric.Path(path.join(' '), options);
    }

    /**
     * Create heart shape
     */
    createHeart(options) {
        const path = 'M 0 -30 C -25 -60 -60 -30 -60 0 C -60 30 -30 55 0 80 C 30 55 60 30 60 0 C 60 -30 25 -60 0 -30 Z';
        return new fabric.Path(path, { ...options, scaleX: 0.8, scaleY: 0.8 });
    }

    /**
     * Create regular polygon
     */
    createPolygon(sides, radius, options) {
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
            points.push({
                x: radius * Math.cos(angle),
                y: radius * Math.sin(angle)
            });
        }
        return new fabric.Polygon(points, options);
    }

    /**
     * Create arrow shape
     */
    createArrow(options) {
        const path = 'M 0 -10 L 80 -10 L 80 -25 L 120 0 L 80 25 L 80 10 L 0 10 Z';
        return new fabric.Path(path, { ...options, scaleX: 0.8, scaleY: 0.8 });
    }

    // =========================================================================
    // Selection & Manipulation Methods
    // =========================================================================

    /**
     * Get currently selected object(s)
     */
    getSelected() {
        return this.fabricCanvas.getActiveObject();
    }

    /**
     * Select all objects
     */
    selectAll() {
        const objects = this.fabricCanvas.getObjects();
        if (objects.length === 0) return;

        if (objects.length === 1) {
            this.fabricCanvas.setActiveObject(objects[0]);
        } else {
            const selection = new fabric.ActiveSelection(objects, {
                canvas: this.fabricCanvas
            });
            this.fabricCanvas.setActiveObject(selection);
        }
        this.fabricCanvas.requestRenderAll();
    }

    /**
     * Deselect all objects
     */
    deselectAll() {
        this.fabricCanvas.discardActiveObject();
        this.fabricCanvas.requestRenderAll();
    }

    /**
     * Delete selected object(s)
     */
    deleteSelected() {
        const active = this.fabricCanvas.getActiveObject();
        if (!active) return;

        if (active.type === 'activeSelection') {
            active.forEachObject((obj) => {
                this.fabricCanvas.remove(obj);
            });
            this.fabricCanvas.discardActiveObject();
        } else {
            this.fabricCanvas.remove(active);
        }

        this.fabricCanvas.requestRenderAll();
        this.events.emit('history:save');
    }

    /**
     * Duplicate selected object(s)
     */
    duplicateSelected() {
        const active = this.fabricCanvas.getActiveObject();
        if (!active) return;

        active.clone((cloned) => {
            cloned.set({
                left: cloned.left + 20,
                top: cloned.top + 20,
                evented: true
            });

            if (cloned.type === 'activeSelection') {
                cloned.canvas = this.fabricCanvas;
                cloned.forEachObject((obj) => {
                    this.fabricCanvas.add(obj);
                });
                cloned.setCoords();
            } else {
                this.fabricCanvas.add(cloned);
            }

            this.fabricCanvas.setActiveObject(cloned);
            this.fabricCanvas.requestRenderAll();
            this.events.emit('history:save');
        });
    }

    /**
     * Copy selected to clipboard
     */
    copy() {
        const active = this.fabricCanvas.getActiveObject();
        if (!active) return;

        active.clone((cloned) => {
            this.clipboard = cloned;
        });
    }

    /**
     * Paste from clipboard
     */
    paste() {
        if (!this.clipboard) return;

        this.clipboard.clone((cloned) => {
            cloned.set({
                left: cloned.left + 20,
                top: cloned.top + 20,
                evented: true
            });

            if (cloned.type === 'activeSelection') {
                cloned.canvas = this.fabricCanvas;
                cloned.forEachObject((obj) => {
                    this.fabricCanvas.add(obj);
                });
                cloned.setCoords();
            } else {
                this.fabricCanvas.add(cloned);
            }

            this.clipboard.top += 20;
            this.clipboard.left += 20;

            this.fabricCanvas.setActiveObject(cloned);
            this.fabricCanvas.requestRenderAll();
            this.events.emit('history:save');
        });
    }

    /**
     * Bring object to front
     */
    bringToFront() {
        const active = this.fabricCanvas.getActiveObject();
        if (active) {
            active.bringToFront();
            this.fabricCanvas.requestRenderAll();
            this.events.emit('history:save');
            this.events.emit('layers:update');
        }
    }

    /**
     * Send object to back
     */
    sendToBack() {
        const active = this.fabricCanvas.getActiveObject();
        if (active) {
            active.sendToBack();
            this.fabricCanvas.requestRenderAll();
            this.events.emit('history:save');
            this.events.emit('layers:update');
        }
    }

    /**
     * Group selected objects
     */
    group() {
        const active = this.fabricCanvas.getActiveObject();
        if (!active || active.type !== 'activeSelection') return;

        const group = active.toGroup();
        this.fabricCanvas.requestRenderAll();
        this.events.emit('history:save');
        return group;
    }

    /**
     * Ungroup selected group
     */
    ungroup() {
        const active = this.fabricCanvas.getActiveObject();
        if (!active || active.type !== 'group') return;

        const items = active.toActiveSelection();
        this.fabricCanvas.requestRenderAll();
        this.events.emit('history:save');
        return items;
    }

    // =========================================================================
    // Zoom Methods
    // =========================================================================

    /**
     * Zoom in
     */
    zoomIn() {
        this.setZoom(this.zoom * 1.2);
    }

    /**
     * Zoom out
     */
    zoomOut() {
        this.setZoom(this.zoom / 1.2);
    }

    /**
     * Zoom to fit canvas in view
     */
    zoomToFit() {
        this.setZoom(1);
    }

    /**
     * Set zoom level
     */
    setZoom(level) {
        this.zoom = Math.min(Math.max(level, 0.1), 5);
        this.fabricCanvas.setZoom(this.zoom);
        this.fabricCanvas.setDimensions({
            width: this.options.width * this.zoom,
            height: this.options.height * this.zoom
        });
        this.updateZoomDisplay();
    }

    /**
     * Update zoom display
     */
    updateZoomDisplay() {
        const display = document.getElementById('zoom-level');
        if (display) {
            display.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }

    // =========================================================================
    // Product/Print Area Methods
    // =========================================================================

    /**
     * Load a product view with its image and print area
     * @param {Object} view - View data from ProductLoader
     */
    loadProductView(view) {
        if (!view) return;

        this.currentView = view;

        // Clear existing product elements
        this.clearProductElements();

        // If view has a product image, load it
        if (view.image) {
            this.loadProductImage(view.image).then(() => {
                // Set up print area after image loads
                if (view.printArea) {
                    this.setupPrintArea(view.printArea);
                }
            });
        } else {
            // No product image - just set up print area as the full canvas
            if (view.printArea) {
                this.setupPrintAreaFullCanvas(view.printArea);
            }
        }
    }

    /**
     * Update just the background/product image (for color changes)
     * Preserves user's design elements
     */
    setBackgroundImage(imageUrl, printArea) {
        if (!imageUrl) return;

        // Save design objects
        const designObjects = this.getDesignObjects();

        // Remove only the product image (keep design objects)
        if (this.productImage) {
            this.fabricCanvas.remove(this.productImage);
            this.productImage = null;
        }

        // Load new product image
        fabric.Image.fromURL(imageUrl, (img) => {
            if (!img) return;

            // Scale to fit canvas
            const scale = Math.min(
                this.options.width / img.width,
                this.options.height / img.height
            ) * 0.95;

            img.scale(scale);
            img.set({
                left: this.options.width / 2,
                top: this.options.height / 2,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                excludeFromExport: true,
                isProductImage: true
            });

            this.productImage = img;

            // Insert at the back (before all design objects)
            this.fabricCanvas.insertAt(img, 0);

            // Move print area marker to be second if it exists
            if (this.printAreaRect) {
                this.fabricCanvas.bringToFront(this.printAreaRect);
                // Then move all design objects on top
                designObjects.forEach(obj => {
                    this.fabricCanvas.bringToFront(obj);
                });
            }

            this.fabricCanvas.renderAll();
        }, { crossOrigin: 'anonymous' });
    }

    /**
     * Load product background image (non-selectable)
     */
    loadProductImage(imageUrl) {
        return new Promise((resolve, reject) => {
            fabric.Image.fromURL(imageUrl, (img) => {
                if (!img) {
                    reject(new Error('Failed to load product image'));
                    return;
                }

                // Scale to fit canvas
                const scale = Math.min(
                    this.options.width / img.width,
                    this.options.height / img.height
                ) * 0.95;

                img.scale(scale);
                img.set({
                    left: this.options.width / 2,
                    top: this.options.height / 2,
                    originX: 'center',
                    originY: 'center',
                    selectable: false,
                    evented: false,
                    excludeFromExport: true, // Don't include in design export
                    isProductImage: true      // Mark as product image
                });

                this.productImage = img;
                this.scaledProductWidth = img.width * scale;
                this.scaledProductHeight = img.height * scale;
                this.imageScale = scale;

                // Add to canvas at bottom
                this.fabricCanvas.add(img);
                img.sendToBack();
                this.fabricCanvas.renderAll();

                resolve(img);
            }, { crossOrigin: 'anonymous' });
        });
    }

    /**
     * Set up print area overlay and clipping based on product image
     * Uses inch dimensions to calculate proper aspect ratio
     *
     * @param {Object} printAreaData - Print area data including:
     *   - widthInches: actual print width in inches
     *   - heightInches: actual print height in inches
     *   - leftPercent: horizontal offset from center as percentage
     *   - topPercent: vertical offset from center as percentage
     *   - widthPercent: max width as percentage of product (for scaling)
     */
    setupPrintArea(printAreaData) {
        if (!this.productImage) return;

        const imgCenterX = this.productImage.left;
        const imgCenterY = this.productImage.top;

        // Get inch dimensions - these determine the aspect ratio
        const widthInches = printAreaData.widthInches || 8;
        const heightInches = printAreaData.heightInches || 10;
        const aspectRatio = widthInches / heightInches;

        // Calculate maximum available space based on percentage settings
        const maxWidth = this.scaledProductWidth * (printAreaData.widthPercent / 100);
        const maxHeight = this.scaledProductHeight * (printAreaData.heightPercent / 100);

        // Calculate print area dimensions maintaining aspect ratio from inches
        // Fit within the max bounds while preserving aspect ratio
        let printWidth, printHeight;

        if (maxWidth / maxHeight > aspectRatio) {
            // Height constrained - use max height, calculate width from aspect ratio
            printHeight = maxHeight;
            printWidth = maxHeight * aspectRatio;
        } else {
            // Width constrained - use max width, calculate height from aspect ratio
            printWidth = maxWidth;
            printHeight = maxWidth / aspectRatio;
        }

        // Calculate position offset from center
        const offsetX = this.scaledProductWidth * (printAreaData.leftPercent / 100);
        const offsetY = this.scaledProductHeight * (printAreaData.topPercent / 100);

        this.printAreaBounds = {
            left: imgCenterX + offsetX - printWidth / 2,
            top: imgCenterY + offsetY - printHeight / 2,
            width: printWidth,
            height: printHeight,
            widthInches: widthInches,
            heightInches: heightInches
        };

        // Store DPI for this print area (pixels per inch on screen)
        this.printAreaDPI = printWidth / widthInches;

        // Create visual print area indicator (dashed rectangle)
        this.createPrintAreaRect();

        // Create clipping path for designs
        this.createClipPath();

        this.fabricCanvas.renderAll();

        console.log(`Print area: ${widthInches}" x ${heightInches}" → ${Math.round(printWidth)}x${Math.round(printHeight)}px (${this.printAreaDPI.toFixed(1)} pixels/inch)`);
    }

    /**
     * Set up print area when no product image (full canvas mode)
     * Maintains aspect ratio from inch dimensions
     */
    setupPrintAreaFullCanvas(printAreaData) {
        // Get inch dimensions
        const widthInches = printAreaData.widthInches || 8;
        const heightInches = printAreaData.heightInches || 10;
        const aspectRatio = widthInches / heightInches;

        // Calculate print area to fit canvas while maintaining aspect ratio
        let printWidth, printHeight;
        const canvasWidth = this.options.width;
        const canvasHeight = this.options.height;
        const padding = 20; // Small padding from edges

        const maxWidth = canvasWidth - padding * 2;
        const maxHeight = canvasHeight - padding * 2;

        if (maxWidth / maxHeight > aspectRatio) {
            // Height constrained
            printHeight = maxHeight;
            printWidth = maxHeight * aspectRatio;
        } else {
            // Width constrained
            printWidth = maxWidth;
            printHeight = maxWidth / aspectRatio;
        }

        // Center in canvas
        this.printAreaBounds = {
            left: (canvasWidth - printWidth) / 2,
            top: (canvasHeight - printHeight) / 2,
            width: printWidth,
            height: printHeight,
            widthInches: widthInches,
            heightInches: heightInches
        };

        // Store DPI for this print area
        this.printAreaDPI = printWidth / widthInches;

        // Create visual rectangle (even without product image)
        this.createPrintAreaRect();

        // Create clipping path
        this.createClipPath();

        this.fabricCanvas.renderAll();

        console.log(`Print area (no product): ${widthInches}" x ${heightInches}" → ${Math.round(printWidth)}x${Math.round(printHeight)}px`);
    }

    /**
     * Create visual print area rectangle (dashed border)
     */
    createPrintAreaRect() {
        if (this.printAreaRect) {
            this.fabricCanvas.remove(this.printAreaRect);
        }

        const bounds = this.printAreaBounds;

        this.printAreaRect = new fabric.Rect({
            left: bounds.left + bounds.width / 2,
            top: bounds.top + bounds.height / 2,
            width: bounds.width,
            height: bounds.height,
            originX: 'center',
            originY: 'center',
            fill: 'transparent',
            stroke: '#3fc7ba',
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
            excludeFromExport: true,
            isPrintAreaRect: true
        });

        this.fabricCanvas.add(this.printAreaRect);

        // Add dimension label
        const label = `${bounds.widthInches}" × ${bounds.heightInches}"`;
        this.printAreaLabel = new fabric.Text(label, {
            left: bounds.left + bounds.width / 2,
            top: bounds.top - 15,
            originX: 'center',
            originY: 'center',
            fontSize: 11,
            fill: '#3fc7ba',
            fontFamily: 'Arial',
            selectable: false,
            evented: false,
            excludeFromExport: true,
            isPrintAreaLabel: true
        });

        this.fabricCanvas.add(this.printAreaLabel);
    }

    /**
     * Create clipping path for constraining designs
     */
    createClipPath() {
        if (!this.printAreaBounds) return;

        const bounds = this.printAreaBounds;

        this.printAreaClipPath = new fabric.Rect({
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            absolutePositioned: true
        });
    }

    /**
     * Apply clipping path to an object
     */
    applyClipPathToObject(obj) {
        if (this.printAreaClipPath && obj && !obj.isProductImage && !obj.isPrintAreaRect && !obj.isPrintAreaLabel) {
            obj.clipPath = this.printAreaClipPath;
            obj.setCoords();
        }
    }

    /**
     * Clear product-related elements (image, print area)
     */
    clearProductElements() {
        const toRemove = [];
        this.fabricCanvas.getObjects().forEach(obj => {
            if (obj.isProductImage || obj.isPrintAreaRect || obj.isPrintAreaLabel) {
                toRemove.push(obj);
            }
        });
        toRemove.forEach(obj => this.fabricCanvas.remove(obj));

        this.productImage = null;
        this.printAreaRect = null;
        this.printAreaLabel = null;
        this.printAreaClipPath = null;
        this.printAreaBounds = null;
        this.currentView = null;
    }

    /**
     * Get only design objects (exclude product image and print area)
     */
    getDesignObjects() {
        return this.fabricCanvas.getObjects().filter(obj =>
            !obj.isProductImage && !obj.isPrintAreaRect && !obj.isPrintAreaLabel
        );
    }

    /**
     * Get print area bounds (for positioning new objects)
     */
    getPrintAreaBounds() {
        return this.printAreaBounds;
    }

    /**
     * Get print area center point
     */
    getPrintAreaCenter() {
        if (!this.printAreaBounds) {
            return {
                x: this.options.width / 2,
                y: this.options.height / 2
            };
        }
        return {
            x: this.printAreaBounds.left + this.printAreaBounds.width / 2,
            y: this.printAreaBounds.top + this.printAreaBounds.height / 2
        };
    }

    // =========================================================================
    // Export Methods
    // =========================================================================

    /**
     * Export canvas to JSON
     * Includes custom properties for high-DPI export
     */
    toJSON() {
        return this.fabricCanvas.toJSON([
            'id', 'name', 'selectable', 'evented', 'lockMovementX', 'lockMovementY',
            'lockRotation', 'lockScalingX', 'lockScalingY', 'hasControls',
            '_originalSrc', '_originalWidth', '_originalHeight'  // For high-DPI export
        ]);
    }

    /**
     * Load canvas from JSON
     */
    loadFromJSON(json) {
        return new Promise((resolve) => {
            this.fabricCanvas.loadFromJSON(json, () => {
                this.fabricCanvas.requestRenderAll();
                this.events.emit('layers:update');
                resolve();
            });
        });
    }

    /**
     * Export canvas to data URL (screen resolution)
     */
    toDataURL(options = {}) {
        return this.fabricCanvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 1,
            ...options
        });
    }

    /**
     * Export canvas at high DPI for print quality
     * This is the KEY method that preserves original image quality
     *
     * @param {number} targetDPI - Target DPI (default 300 for print)
     * @param {number} screenDPI - Screen/design DPI (default 72)
     * @returns {Promise<string>} - Data URL of high-res export
     */
    async exportForPrint(targetDPI = 300, screenDPI = 72) {
        const multiplier = targetDPI / screenDPI;

        console.log(`Exporting at ${targetDPI} DPI (${multiplier}x multiplier)`);
        console.log(`Output size: ${this.options.width * multiplier}x${this.options.height * multiplier}px`);

        // Create a temporary high-res canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.options.width * multiplier;
        tempCanvas.height = this.options.height * multiplier;
        const ctx = tempCanvas.getContext('2d');

        // Fill background
        ctx.fillStyle = this.options.backgroundColor || '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Get all objects in their z-order
        const objects = this.fabricCanvas.getObjects();

        // Render each object at high resolution
        for (const obj of objects) {
            await this.renderObjectHighRes(ctx, obj, multiplier);
        }

        return tempCanvas.toDataURL('image/png', 1.0);
    }

    /**
     * Render a single object at high resolution
     * Uses original image source for images, scales vectors properly
     */
    renderObjectHighRes(ctx, obj, multiplier) {
        return new Promise((resolve) => {
            ctx.save();

            // Calculate position at high resolution
            const left = obj.left * multiplier;
            const top = obj.top * multiplier;
            const angle = obj.angle || 0;

            // Move to object position and apply rotation
            ctx.translate(left, top);
            ctx.rotate(angle * Math.PI / 180);

            // Apply opacity
            ctx.globalAlpha = obj.opacity || 1;

            if (obj.type === 'image' && obj._originalSrc) {
                // For images: reload from original source at full quality
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    // Calculate the display size at high resolution
                    const displayWidth = obj.width * obj.scaleX * multiplier;
                    const displayHeight = obj.height * obj.scaleY * multiplier;

                    // Draw from original high-res source
                    ctx.drawImage(
                        img,
                        -displayWidth / 2,  // Center the image (assuming originX: 'center')
                        -displayHeight / 2, // Center the image (assuming originY: 'center')
                        displayWidth,
                        displayHeight
                    );

                    console.log(`Image rendered: Original ${img.naturalWidth}x${img.naturalHeight}px → Display ${Math.round(displayWidth)}x${Math.round(displayHeight)}px`);
                    ctx.restore();
                    resolve();
                };
                img.onerror = () => {
                    console.error('Failed to load original image for export');
                    ctx.restore();
                    resolve();
                };
                img.src = obj._originalSrc;
            } else if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                // For text: render at high resolution (vector-based, scales perfectly)
                const fontSize = (obj.fontSize || 24) * multiplier * (obj.scaleX || 1);
                ctx.font = `${obj.fontStyle || ''} ${obj.fontWeight || ''} ${fontSize}px ${obj.fontFamily || 'Arial'}`.trim();
                ctx.fillStyle = obj.fill || '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(obj.text || '', 0, 0);
                ctx.restore();
                resolve();
            } else {
                // For shapes: use fabric's built-in high-res rendering
                // Create a temporary fabric canvas at high res for this object
                const objCanvas = document.createElement('canvas');
                const padding = 10 * multiplier;
                const objWidth = (obj.width || 100) * (obj.scaleX || 1) * multiplier + padding * 2;
                const objHeight = (obj.height || 100) * (obj.scaleY || 1) * multiplier + padding * 2;
                objCanvas.width = objWidth;
                objCanvas.height = objHeight;

                const tempFabric = new fabric.StaticCanvas(objCanvas);

                obj.clone((cloned) => {
                    cloned.set({
                        left: objWidth / 2,
                        top: objHeight / 2,
                        scaleX: (obj.scaleX || 1) * multiplier,
                        scaleY: (obj.scaleY || 1) * multiplier,
                        angle: 0 // Reset angle as we handle it in ctx
                    });

                    tempFabric.add(cloned);
                    tempFabric.renderAll();

                    ctx.drawImage(
                        objCanvas,
                        -objWidth / 2,
                        -objHeight / 2
                    );

                    ctx.restore();
                    resolve();
                });
            }
        });
    }

    /**
     * Download design as high-res PNG for print
     */
    async downloadForPrint(filename = 'design-print.png', targetDPI = 300) {
        const dataUrl = await this.exportForPrint(targetDPI);

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();

        console.log(`Downloaded ${filename} at ${targetDPI} DPI`);
    }

    /**
     * Clear canvas
     */
    clear() {
        this.fabricCanvas.clear();
        this.fabricCanvas.backgroundColor = this.options.backgroundColor;
        this.fabricCanvas.requestRenderAll();
        this.events.emit('history:save');
        this.events.emit('layers:update');
    }

    /**
     * Get all objects
     */
    getObjects() {
        return this.fabricCanvas.getObjects();
    }

    /**
     * Render canvas
     */
    render() {
        this.fabricCanvas.requestRenderAll();
    }
}
