/**
 * PrintAreaEditor - Visual editor for defining print areas on products
 *
 * Allows admin to:
 * 1. Upload a product image (e.g., t-shirt photo)
 * 2. Set actual print dimensions in inches (determines aspect ratio)
 * 3. Drag and position the print area on the product
 * 4. Rectangle automatically maintains aspect ratio based on inch dimensions
 */

export class PrintAreaEditor {
    constructor(canvasId, options = {}) {
        this.canvasId = canvasId;
        this.options = {
            maxWidth: 500,
            maxHeight: 400,
            printAreaColor: 'rgba(63, 199, 186, 0.3)',
            printAreaBorder: '#3fc7ba',
            ...options
        };

        this.canvas = null;
        this.productImage = null;
        this.printAreaRect = null;
        this.printAreaLabel = null;
        this.currentView = null;
        this.views = [];

        // Print dimensions in inches (these determine aspect ratio)
        this.printWidthInches = 8;
        this.printHeightInches = 10;

        this.onChangeCallback = null;
    }

    /**
     * Initialize the fabric canvas
     */
    init() {
        const canvasEl = document.getElementById(this.canvasId);
        if (!canvasEl) {
            console.error('Canvas element not found:', this.canvasId);
            return;
        }

        this.canvas = new fabric.Canvas(this.canvasId, {
            selection: false,
            backgroundColor: '#e0e0e0'
        });

        // Set initial size
        this.canvas.setWidth(this.options.maxWidth);
        this.canvas.setHeight(this.options.maxHeight);

        // Set up input listeners for inch dimensions
        this.setupDimensionInputs();
    }

    /**
     * Set up listeners for print dimension inputs
     */
    setupDimensionInputs() {
        const widthInput = document.getElementById('print-area-width');
        const heightInput = document.getElementById('print-area-height');

        if (widthInput) {
            widthInput.addEventListener('change', () => {
                this.printWidthInches = parseFloat(widthInput.value) || 8;
                this.updateRectAspectRatio();
            });
            widthInput.addEventListener('input', () => {
                this.printWidthInches = parseFloat(widthInput.value) || 8;
                this.updateRectAspectRatio();
            });
        }

        if (heightInput) {
            heightInput.addEventListener('change', () => {
                this.printHeightInches = parseFloat(heightInput.value) || 10;
                this.updateRectAspectRatio();
            });
            heightInput.addEventListener('input', () => {
                this.printHeightInches = parseFloat(heightInput.value) || 10;
                this.updateRectAspectRatio();
            });
        }
    }

    /**
     * Load a product image for a view
     */
    loadProductImage(imageUrl) {
        return new Promise((resolve, reject) => {
            if (!this.canvas) {
                this.init();
            }

            // Clear existing objects
            this.canvas.clear();
            this.canvas.backgroundColor = '#e0e0e0';

            fabric.Image.fromURL(imageUrl, (img) => {
                if (!img) {
                    reject(new Error('Failed to load image'));
                    return;
                }

                // Calculate scale to fit canvas
                const scale = Math.min(
                    this.options.maxWidth / img.width,
                    this.options.maxHeight / img.height
                ) * 0.9; // 90% to leave some margin

                img.scale(scale);

                // Center the image
                img.set({
                    left: this.options.maxWidth / 2,
                    top: this.options.maxHeight / 2,
                    originX: 'center',
                    originY: 'center',
                    selectable: false,
                    evented: false
                });

                this.productImage = img;
                this.canvas.add(img);

                // Store the scaled dimensions for calculations
                this.scaledProductWidth = img.width * scale;
                this.scaledProductHeight = img.height * scale;
                this.imageScale = scale;

                // Read current inch values from inputs
                const widthInput = document.getElementById('print-area-width');
                const heightInput = document.getElementById('print-area-height');
                if (widthInput) this.printWidthInches = parseFloat(widthInput.value) || 8;
                if (heightInput) this.printHeightInches = parseFloat(heightInput.value) || 10;

                // Add print area rectangle
                this.addPrintAreaRect();

                this.canvas.renderAll();

                // Hide placeholder, show canvas
                document.getElementById('print-area-placeholder')?.classList.add('hidden');

                resolve(img);
            }, { crossOrigin: 'anonymous' });
        });
    }

    /**
     * Add the draggable print area rectangle
     * Size is determined by inch dimensions, maintaining aspect ratio
     */
    addPrintAreaRect(existingData = null) {
        // Remove existing rect and label if any
        if (this.printAreaRect) {
            this.canvas.remove(this.printAreaRect);
        }
        if (this.printAreaLabel) {
            this.canvas.remove(this.printAreaLabel);
        }

        // Calculate aspect ratio from inch dimensions
        const aspectRatio = this.printWidthInches / this.printHeightInches;

        let rectWidth, rectHeight, rectLeft, rectTop;

        if (existingData && existingData.leftPercent !== undefined) {
            // Load from existing position data
            // Calculate size based on aspect ratio, fitting within stored percentage bounds
            const maxWidth = this.scaledProductWidth * (existingData.widthPercent / 100);
            const maxHeight = this.scaledProductHeight * (existingData.heightPercent / 100);

            // Fit within bounds maintaining aspect ratio
            if (maxWidth / maxHeight > aspectRatio) {
                rectHeight = maxHeight;
                rectWidth = maxHeight * aspectRatio;
            } else {
                rectWidth = maxWidth;
                rectHeight = maxWidth / aspectRatio;
            }

            rectLeft = this.options.maxWidth / 2 + (existingData.leftPercent / 100) * this.scaledProductWidth;
            rectTop = this.options.maxHeight / 2 + (existingData.topPercent / 100) * this.scaledProductHeight;
        } else {
            // Default: centered, sized to fit nicely while maintaining aspect ratio
            const maxWidth = this.scaledProductWidth * 0.5;
            const maxHeight = this.scaledProductHeight * 0.6;

            if (maxWidth / maxHeight > aspectRatio) {
                rectHeight = maxHeight;
                rectWidth = maxHeight * aspectRatio;
            } else {
                rectWidth = maxWidth;
                rectHeight = maxWidth / aspectRatio;
            }

            rectLeft = this.options.maxWidth / 2;
            rectTop = this.options.maxHeight / 2;
        }

        this.printAreaRect = new fabric.Rect({
            width: rectWidth,
            height: rectHeight,
            left: rectLeft,
            top: rectTop,
            originX: 'center',
            originY: 'center',
            fill: this.options.printAreaColor,
            stroke: this.options.printAreaBorder,
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            cornerColor: this.options.printAreaBorder,
            cornerSize: 10,
            cornerStyle: 'circle',
            transparentCorners: false,
            borderColor: this.options.printAreaBorder,
            hasRotatingPoint: false,  // No rotation for print area
            lockRotation: true,
            lockUniScaling: true      // Lock aspect ratio when scaling
        });

        // Add label showing dimensions
        this.updateLabel();

        this.canvas.add(this.printAreaRect);
        this.canvas.add(this.printAreaLabel);
        this.canvas.setActiveObject(this.printAreaRect);

        // Event handlers
        this.printAreaRect.on('moving', () => this.onPrintAreaChange());
        this.printAreaRect.on('scaling', () => this.onPrintAreaScaling());
        this.printAreaRect.on('modified', () => this.onPrintAreaChange());

        this.canvas.renderAll();
    }

    /**
     * Update the print area rectangle's aspect ratio based on inch dimensions
     * Maintains current position and approximate size
     */
    updateRectAspectRatio() {
        if (!this.printAreaRect || !this.productImage) return;

        const aspectRatio = this.printWidthInches / this.printHeightInches;

        // Get current rect dimensions
        const currentWidth = this.printAreaRect.width * this.printAreaRect.scaleX;
        const currentHeight = this.printAreaRect.height * this.printAreaRect.scaleY;
        const currentArea = currentWidth * currentHeight;

        // Calculate new dimensions maintaining same approximate area but new aspect ratio
        // Area = width * height, aspectRatio = width / height
        // width = sqrt(Area * aspectRatio), height = sqrt(Area / aspectRatio)
        let newWidth = Math.sqrt(currentArea * aspectRatio);
        let newHeight = Math.sqrt(currentArea / aspectRatio);

        // Constrain to product image bounds
        const maxWidth = this.scaledProductWidth * 0.9;
        const maxHeight = this.scaledProductHeight * 0.9;

        if (newWidth > maxWidth) {
            newWidth = maxWidth;
            newHeight = newWidth / aspectRatio;
        }
        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
        }

        // Update rectangle (reset scale and set new width/height)
        this.printAreaRect.set({
            width: newWidth,
            height: newHeight,
            scaleX: 1,
            scaleY: 1
        });

        this.printAreaRect.setCoords();
        this.constrainToProductImage();
        this.updateLabel();
        this.canvas.renderAll();

        // Notify callback
        if (this.onChangeCallback) {
            this.onChangeCallback(this.getPrintAreaData());
        }
    }

    /**
     * Handle scaling - maintain aspect ratio
     */
    onPrintAreaScaling() {
        if (!this.printAreaRect) return;

        // Get the current scale
        const scaleX = this.printAreaRect.scaleX;
        const scaleY = this.printAreaRect.scaleY;

        // Use the larger scale to maintain aspect ratio
        const scale = Math.max(scaleX, scaleY);

        this.printAreaRect.set({
            scaleX: scale,
            scaleY: scale
        });

        this.updateLabel();
        this.constrainToProductImage();
        this.canvas.renderAll();
    }

    /**
     * Update label text and position
     */
    updateLabel() {
        const labelText = `${this.printWidthInches}" x ${this.printHeightInches}"`;

        if (!this.printAreaLabel) {
            this.printAreaLabel = new fabric.Text(labelText, {
                fontSize: 12,
                fill: this.options.printAreaBorder,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false
            });
        } else {
            this.printAreaLabel.set('text', labelText);
        }

        // Position label in center of rect
        if (this.printAreaRect) {
            this.printAreaLabel.set({
                left: this.printAreaRect.left,
                top: this.printAreaRect.top
            });
        }
    }

    /**
     * Handle print area changes (movement)
     */
    onPrintAreaChange() {
        this.updateLabel();
        this.constrainToProductImage();
        this.canvas.renderAll();

        // Notify callback
        if (this.onChangeCallback) {
            this.onChangeCallback(this.getPrintAreaData());
        }
    }

    /**
     * Constrain print area to stay within product image bounds
     */
    constrainToProductImage() {
        if (!this.printAreaRect || !this.productImage) return;

        const rect = this.printAreaRect;
        const imgLeft = this.productImage.left - (this.scaledProductWidth / 2);
        const imgTop = this.productImage.top - (this.scaledProductHeight / 2);
        const imgRight = imgLeft + this.scaledProductWidth;
        const imgBottom = imgTop + this.scaledProductHeight;

        const rectWidth = rect.width * rect.scaleX;
        const rectHeight = rect.height * rect.scaleY;
        const rectLeft = rect.left - rectWidth / 2;
        const rectTop = rect.top - rectHeight / 2;

        // Constrain position
        let newLeft = rect.left;
        let newTop = rect.top;

        if (rectLeft < imgLeft) {
            newLeft = imgLeft + rectWidth / 2;
        }
        if (rectTop < imgTop) {
            newTop = imgTop + rectHeight / 2;
        }
        if (rectLeft + rectWidth > imgRight) {
            newLeft = imgRight - rectWidth / 2;
        }
        if (rectTop + rectHeight > imgBottom) {
            newTop = imgBottom - rectHeight / 2;
        }

        rect.set({ left: newLeft, top: newTop });
        rect.setCoords();

        // Also update label position
        if (this.printAreaLabel) {
            this.printAreaLabel.set({ left: newLeft, top: newTop });
        }
    }

    /**
     * Get print area data for storage
     */
    getPrintAreaData() {
        if (!this.printAreaRect || !this.productImage) return null;

        const rect = this.printAreaRect;
        const rectWidth = rect.width * rect.scaleX;
        const rectHeight = rect.height * rect.scaleY;

        // Calculate position relative to product image center
        const offsetX = rect.left - this.productImage.left;
        const offsetY = rect.top - this.productImage.top;

        // Convert to percentages of product image
        return {
            widthPercent: (rectWidth / this.scaledProductWidth) * 100,
            heightPercent: (rectHeight / this.scaledProductHeight) * 100,
            leftPercent: (offsetX / this.scaledProductWidth) * 100,
            topPercent: (offsetY / this.scaledProductHeight) * 100,
            // Actual print dimensions in inches
            printWidthInches: this.printWidthInches,
            printHeightInches: this.printHeightInches
        };
    }

    /**
     * Set print area from stored data
     */
    setPrintAreaData(data) {
        if (!data || !this.productImage) return;

        // Update inch dimension values
        if (data.printWidthInches) {
            this.printWidthInches = data.printWidthInches;
            const widthInput = document.getElementById('print-area-width');
            if (widthInput) widthInput.value = data.printWidthInches;
        }
        if (data.printHeightInches) {
            this.printHeightInches = data.printHeightInches;
            const heightInput = document.getElementById('print-area-height');
            if (heightInput) heightInput.value = data.printHeightInches;
        }

        // Recreate rectangle with stored data
        this.addPrintAreaRect(data);
    }

    /**
     * Set callback for changes
     */
    onChange(callback) {
        this.onChangeCallback = callback;
    }

    /**
     * Destroy the editor
     */
    destroy() {
        if (this.canvas) {
            this.canvas.dispose();
            this.canvas = null;
        }
    }

    /**
     * Show placeholder (no image loaded)
     */
    showPlaceholder() {
        document.getElementById('print-area-placeholder')?.classList.remove('hidden');
        if (this.canvas) {
            this.canvas.clear();
            this.canvas.backgroundColor = '#e0e0e0';
            this.canvas.renderAll();
        }
    }
}
