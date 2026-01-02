/**
 * Designer - Main controller class
 * Coordinates all modules and manages the design workflow
 */

import { CanvasManager } from './CanvasManager.js';
import { ProductLoader, productLoader } from './ProductLoader.js';
import { ToolbarManager } from '../modules/ToolbarManager.js';
import { SidebarManager } from '../modules/SidebarManager.js';
import { LayerManager } from '../modules/LayerManager.js';
import { HistoryManager } from '../modules/HistoryManager.js';
import { StageManager } from '../modules/StageManager.js';

export class Designer {
    constructor(options = {}) {
        this.options = {
            canvasId: 'design-canvas',
            width: 600,
            height: 600,
            backgroundColor: '#ffffff',
            productId: null,  // Optional: Load specific product on init
            ...options
        };

        this.events = window.designerEvents;
        this.modules = {};
        this.productLoader = productLoader;
        this.currentProduct = null;

        this.init();
    }

    /**
     * Initialize all modules
     */
    init() {
        // Initialize canvas first (core dependency)
        this.canvas = new CanvasManager(this.options);

        // Initialize history manager (for undo/redo)
        this.modules.history = new HistoryManager(this.canvas);

        // Initialize stage manager (multi-view support) - pass CanvasManager
        this.modules.stages = new StageManager(this.canvas);

        // Initialize UI managers
        this.modules.toolbar = new ToolbarManager(this.canvas);
        this.modules.sidebar = new SidebarManager(this.canvas);
        this.modules.layers = new LayerManager(this.canvas);

        // Set up global keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Set up event listeners
        this.setupEventListeners();

        // Set up product selector
        this.setupProductSelector();

        // Set up color selector
        this.setupColorSelector();

        // Set up size selector
        this.setupSizeSelector();

        // Set up VAS panel
        this.setupVASPanel();

        // If a product ID was provided, load it
        if (this.options.productId) {
            this.loadProduct(this.options.productId);
        } else {
            // Check for products and show selector or defaults
            this.checkAvailableProducts();
        }

        // Emit ready event
        this.events.emit('designer:ready', this);
    }

    /**
     * Set up product selector dropdown
     */
    setupProductSelector() {
        const selector = document.getElementById('product-selector');
        if (!selector) return;

        // Populate with available products
        this.populateProductSelector();

        // Handle selection change
        selector.addEventListener('change', (e) => {
            const productId = e.target.value;
            if (productId) {
                this.loadProduct(productId);
            }
        });
    }

    /**
     * Populate product selector with available products
     */
    populateProductSelector() {
        const selector = document.getElementById('product-selector');
        if (!selector) return;

        const products = this.productLoader.getProducts();

        // Clear existing options except first
        selector.innerHTML = '<option value="">Select a Product...</option>';

        products.forEach(product => {
            const option = document.createElement('option');
            option.value = product.id;
            option.textContent = product.name;
            selector.appendChild(option);
        });

        // Show/hide based on product availability
        const selectorContainer = selector.closest('.product-selector-container');
        if (selectorContainer) {
            selectorContainer.style.display = products.length > 0 ? 'flex' : 'none';
        }
    }

    /**
     * Set up color selector
     */
    setupColorSelector() {
        // Event delegation for color swatches
        const swatchesContainer = document.getElementById('color-swatches');
        if (!swatchesContainer) return;

        swatchesContainer.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;

            const colorId = swatch.dataset.colorId;
            if (colorId) {
                this.switchColor(colorId);
            }
        });
    }

    /**
     * Render color swatches for current product
     */
    renderColorSwatches(colors) {
        const container = document.getElementById('color-swatches');
        const colorSelector = document.getElementById('color-selector');

        if (!container) return;

        // Hide selector if no colors or only one color
        if (!colors || colors.length <= 1) {
            if (colorSelector) colorSelector.style.display = 'none';
            return;
        }

        // Show the selector
        if (colorSelector) colorSelector.style.display = 'flex';

        // Helper to determine if a color is light (needs dark checkmark)
        const isLightColor = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 180;
        };

        container.innerHTML = colors.map(color => `
            <button
                class="color-swatch ${color.isActive ? 'active' : ''} ${isLightColor(color.colorCode) ? 'light-color' : ''}"
                data-color-id="${color.id}"
                style="background-color: ${color.colorCode}"
                title="${color.name}"
            ></button>
        `).join('');
    }

    /**
     * Switch to a different color
     */
    switchColor(colorId) {
        const view = this.productLoader.switchColorById(colorId);
        if (!view) return;

        // Update color swatches UI
        const colors = this.productLoader.getColors();
        this.renderColorSwatches(colors);

        // Reload the current view with new color's image
        this.events.emit('color:changed', { colorId, view });

        // Update the canvas with new mockup image
        this.canvas.setBackgroundImage(view.image, view.printArea);

        // Update all stages' images to use new color
        this.modules.stages.refreshStageImagesForColor(this.productLoader);

        console.log(`Switched to color: ${colorId}`);
    }

    /**
     * Set up size selector
     */
    setupSizeSelector() {
        const sizeDropdown = document.getElementById('size-dropdown');
        if (!sizeDropdown) return;

        sizeDropdown.addEventListener('change', (e) => {
            const sizeId = e.target.value;
            this.switchSize(sizeId);
        });
    }

    /**
     * Render size dropdown for current product
     */
    renderSizeDropdown(sizes) {
        const dropdown = document.getElementById('size-dropdown');
        const sizeSelector = document.getElementById('size-selector');

        if (!dropdown) return;

        // Hide selector if no sizes
        if (!sizes || sizes.length === 0) {
            if (sizeSelector) sizeSelector.style.display = 'none';
            return;
        }

        // Show the selector
        if (sizeSelector) sizeSelector.style.display = 'flex';

        // Render options
        dropdown.innerHTML = '<option value="">Select Size</option>' +
            sizes.map(size => {
                const upchargeText = size.upcharge > 0 ? ` (+$${size.upcharge.toFixed(2)})` : '';
                return `<option value="${size.id}" ${size.isActive ? 'selected' : ''}>${size.name}${upchargeText}</option>`;
            }).join('');

        // Update upcharge badge
        this.updateSizeUpchargeBadge();
    }

    /**
     * Update size upcharge badge visibility
     */
    updateSizeUpchargeBadge() {
        const badge = document.getElementById('size-upcharge');
        const currentSize = this.productLoader.getCurrentSize();

        if (!badge) return;

        if (currentSize && currentSize.upcharge > 0) {
            badge.textContent = `+$${currentSize.upcharge.toFixed(2)}`;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * Switch to a different size
     */
    switchSize(sizeId) {
        this.productLoader.switchSizeById(sizeId);

        // Update UI
        this.updateSizeUpchargeBadge();

        // Emit event
        this.events.emit('size:changed', { sizeId });

        // Re-render VAS panel (neck tags depend on size)
        this.renderVASPanel();

        console.log(`Switched to size: ${sizeId}`);
    }

    /**
     * Set up VAS panel
     */
    setupVASPanel() {
        // VAS panel interactions are handled through event delegation
        const vasList = document.getElementById('vas-services-list');
        if (!vasList) return;

        vasList.addEventListener('click', (e) => {
            const header = e.target.closest('.vas-service-header');
            if (header) {
                const item = header.closest('.vas-service-item');
                const serviceType = item?.dataset.service;
                if (serviceType) {
                    this.toggleVASService(serviceType, item);
                }
            }

            // Handle neck tag upload button
            const uploadBtn = e.target.closest('.neck-tag-upload-btn');
            if (uploadBtn) {
                const sizeId = uploadBtn.dataset.sizeId;
                if (sizeId) {
                    this.triggerNeckTagUpload(sizeId);
                }
            }
        });
    }

    /**
     * Render VAS panel for current product
     */
    renderVASPanel() {
        const container = document.getElementById('vas-services-list');
        if (!container) return;

        const vas = this.productLoader.getVAS();
        const sizes = this.productLoader.getSizes();
        const selectedVAS = this.productLoader.getSelectedVAS();

        if (!vas) {
            container.innerHTML = '<div class="vas-loading"><p>Select a product to see available services</p></div>';
            return;
        }

        let html = '';

        // Fold & Bag
        if (vas.foldAndBag && vas.foldAndBag.enabled) {
            const isActive = selectedVAS.foldAndBag;
            html += `
                <div class="vas-service-item ${isActive ? 'active' : ''}" data-service="foldAndBag">
                    <div class="vas-service-header">
                        <div class="vas-service-info">
                            <i class="fas fa-box-open"></i>
                            <span class="vas-service-name">Fold & Bag</span>
                        </div>
                        <span class="vas-service-price">+$${vas.foldAndBag.price.toFixed(2)}</span>
                    </div>
                    <div class="vas-service-body">
                        <p class="vas-service-desc">${vas.foldAndBag.description || 'Individual poly bag packaging for each item.'}</p>
                    </div>
                </div>
            `;
        }

        // Neck Tags
        if (vas.neckTags && vas.neckTags.enabled) {
            const isActive = selectedVAS.neckTags;
            const canEnable = sizes && sizes.length > 0;

            html += `
                <div class="vas-service-item ${isActive ? 'active' : ''}" data-service="neckTags">
                    <div class="vas-service-header">
                        <div class="vas-service-info">
                            <i class="fas fa-tag"></i>
                            <span class="vas-service-name">Neck Tags</span>
                        </div>
                        <span class="vas-service-price">+$${vas.neckTags.price.toFixed(2)}/ea</span>
                    </div>
                    <div class="vas-service-body">
                        <p class="vas-service-desc">${vas.neckTags.description || 'Custom printed neck label for each item.'}</p>
                        ${canEnable ? this.renderNeckTagsSizes(sizes, selectedVAS.neckTagImages) : `
                            <div class="vas-no-sizes-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                <p>You need to pick some sizes first before using this function.</p>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }

        if (!html) {
            html = '<div class="vas-loading"><p>No value added services available for this product</p></div>';
        }

        container.innerHTML = html;
    }

    /**
     * Render neck tag size upload fields
     */
    renderNeckTagsSizes(sizes, neckTagImages = {}) {
        return `
            <div class="neck-tags-sizes">
                ${sizes.map(size => {
                    const hasImage = neckTagImages[size.id];
                    return `
                        <div class="neck-tag-size-item">
                            <span class="neck-tag-size-label">${size.name}</span>
                            ${hasImage ? `<img src="${hasImage}" class="neck-tag-preview" alt="${size.name} tag">` : ''}
                            <button class="neck-tag-upload-btn ${hasImage ? 'has-image' : ''}" data-size-id="${size.id}">
                                <i class="fas fa-${hasImage ? 'check' : 'upload'}"></i>
                                ${hasImage ? 'Change' : 'Upload'}
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Toggle a VAS service
     */
    toggleVASService(serviceType, itemElement) {
        const isActive = itemElement.classList.contains('active');

        // For neck tags, check if sizes are available
        if (serviceType === 'neckTags' && !isActive && !this.productLoader.canEnableNeckTags()) {
            alert('You need to pick some sizes first before using this function.');
            return;
        }

        // Toggle state
        if (serviceType === 'foldAndBag') {
            this.productLoader.toggleFoldAndBag(!isActive);
        } else if (serviceType === 'neckTags') {
            this.productLoader.toggleNeckTags(!isActive);
        }

        itemElement.classList.toggle('active');
        this.events.emit('vas:changed', { serviceType, enabled: !isActive });
    }

    /**
     * Trigger file upload for neck tag image
     */
    triggerNeckTagUpload(sizeId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                this.productLoader.setNeckTagImage(sizeId, evt.target.result);
                this.renderVASPanel();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    /**
     * Check for available products
     */
    checkAvailableProducts() {
        const products = this.productLoader.getProducts();

        if (products.length > 0) {
            // Auto-load first product if only one exists
            if (products.length === 1) {
                this.loadProduct(products[0].id);
            } else {
                // Multiple products - initialize with defaults until user selects
                this.modules.stages.initializeDefaultStages();
            }
        } else {
            // No products configured - use defaults
            console.log('No products configured in admin. Using default canvas.');
            this.modules.stages.initializeDefaultStages();
        }
    }

    /**
     * Load a product by ID
     */
    loadProduct(productId) {
        const productData = this.productLoader.loadProduct(productId);

        if (!productData) {
            console.error('Failed to load product:', productId);
            return false;
        }

        this.currentProduct = productData;

        // Update product selector to show current selection
        const selector = document.getElementById('product-selector');
        if (selector) {
            selector.value = productId;
        }

        // Update product info display
        this.updateProductInfo(productData);

        // Render color swatches
        this.renderColorSwatches(productData.colors);

        // Render size dropdown
        this.renderSizeDropdown(productData.sizes);

        // Render VAS panel
        this.renderVASPanel();

        // Emit event to load views in StageManager
        this.events.emit('product:loaded', productData);

        console.log(`Loaded product: ${productData.name} with ${productData.views.length} view(s), ${productData.colors?.length || 0} color(s)`);
        return true;
    }

    /**
     * Update product info display
     */
    updateProductInfo(productData) {
        const nameEl = document.getElementById('product-name');
        const priceEl = document.getElementById('product-price');

        if (nameEl) {
            nameEl.textContent = productData.name;
        }
        if (priceEl) {
            priceEl.textContent = productData.price > 0 ? `$${productData.price.toFixed(2)}` : '';
        }
    }

    /**
     * Get current product
     */
    getCurrentProduct() {
        return this.currentProduct;
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const ctrl = e.ctrlKey || e.metaKey;

            // Undo: Ctrl+Z
            if (ctrl && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.modules.history.undo();
            }

            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                this.modules.history.redo();
            }

            // Delete: Delete or Backspace
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.canvas.deleteSelected();
            }

            // Duplicate: Ctrl+D
            if (ctrl && e.key === 'd') {
                e.preventDefault();
                this.canvas.duplicateSelected();
            }

            // Select All: Ctrl+A
            if (ctrl && e.key === 'a') {
                e.preventDefault();
                this.canvas.selectAll();
            }

            // Deselect: Escape
            if (e.key === 'Escape') {
                this.canvas.deselectAll();
            }

            // Copy: Ctrl+C
            if (ctrl && e.key === 'c') {
                e.preventDefault();
                this.canvas.copy();
            }

            // Paste: Ctrl+V
            if (ctrl && e.key === 'v') {
                e.preventDefault();
                this.canvas.paste();
            }
        });
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Handle header actions
        document.querySelectorAll('#designer-header [data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleAction(action);
            });
        });

        // Handle zoom controls
        document.querySelectorAll('#zoom-controls [data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleZoom(action);
            });
        });

        // Set up export dropdown
        this.setupExportDropdown();
    }

    /**
     * Set up export dropdown functionality
     */
    setupExportDropdown() {
        const dropdown = document.getElementById('export-dropdown');
        if (!dropdown) return;

        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');

        // Toggle dropdown on click
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
        });

        // Handle dropdown menu items
        menu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleExport(action);
                dropdown.classList.remove('open');
            });
        });
    }

    /**
     * Handle export actions
     */
    handleExport(action) {
        switch (action) {
            case 'download-screen':
                this.downloadScreen();
                break;
            case 'download-print':
                this.downloadPrint();
                break;
            case 'download-json':
                this.downloadJSON();
                break;
        }
    }

    /**
     * Handle header actions
     */
    handleAction(action) {
        switch (action) {
            case 'undo':
                this.modules.history.undo();
                break;
            case 'redo':
                this.modules.history.redo();
                break;
            case 'save':
                this.saveDesign();
                break;
            case 'load':
                this.loadDesign();
                break;
            case 'preview':
                this.preview();
                break;
            case 'download':
                this.download();
                break;
            case 'add-to-cart':
                this.addToCart();
                break;
        }
    }

    /**
     * Handle zoom actions
     */
    handleZoom(action) {
        switch (action) {
            case 'zoom-in':
                this.canvas.zoomIn();
                break;
            case 'zoom-out':
                this.canvas.zoomOut();
                break;
            case 'zoom-fit':
                this.canvas.zoomToFit();
                break;
        }
    }

    /**
     * Save design to JSON
     */
    saveDesign() {
        const data = this.getDesignData();
        const json = JSON.stringify(data);

        // For now, save to localStorage
        localStorage.setItem('cpd_savedDesign', json);

        this.events.emit('design:saved', data);
        alert('Design saved!');
    }

    /**
     * Load design from JSON
     */
    loadDesign() {
        const json = localStorage.getItem('cpd_savedDesign');
        if (json) {
            try {
                const data = JSON.parse(json);

                // Load product if specified
                if (data.productId) {
                    this.loadProduct(data.productId);
                }

                // Load stages data
                if (data.stages) {
                    this.modules.stages.loadStagesData(data.stages);
                }

                this.events.emit('design:loaded', data);
                alert('Design loaded!');
            } catch (error) {
                console.error('Failed to load design:', error);
                alert('Failed to load design');
            }
        } else {
            alert('No saved design found');
        }
    }

    /**
     * Preview design
     */
    preview() {
        const dataUrl = this.canvas.toDataURL();
        const win = window.open('', '_blank');
        win.document.write(`
            <html>
            <head><title>Design Preview</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0;">
                <img src="${dataUrl}" style="max-width:90%;max-height:90vh;box-shadow:0 4px 20px rgba(0,0,0,0.2);">
            </body>
            </html>
        `);
    }

    /**
     * Download design as PNG (legacy - now uses downloadScreen)
     */
    download() {
        this.downloadScreen();
    }

    /**
     * Download at screen resolution (72 DPI)
     */
    downloadScreen() {
        const dataUrl = this.canvas.toDataURL({ format: 'png', multiplier: 1 });
        const link = document.createElement('a');
        link.download = 'design-screen-72dpi.png';
        link.href = dataUrl;
        link.click();

        console.log('Downloaded screen resolution (72 DPI)');
        this.events.emit('design:downloaded', { dpi: 72 });
    }

    /**
     * Download at print quality (300 DPI)
     * Uses original high-res image sources for maximum quality
     */
    async downloadPrint() {
        console.log('Preparing high-resolution export (300 DPI)...');

        try {
            await this.canvas.downloadForPrint('design-print-300dpi.png', 300);
            console.log('Downloaded print resolution (300 DPI)');
            this.events.emit('design:downloaded', { dpi: 300 });
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export at print resolution. Please try again.');
        }
    }

    /**
     * Download as editable JSON
     */
    downloadJSON() {
        const data = this.getDesignData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = 'design.json';
        link.href = url;
        link.click();

        URL.revokeObjectURL(url);
        console.log('Downloaded editable JSON');
        this.events.emit('design:downloaded', { format: 'json' });
    }

    /**
     * Add to cart
     */
    addToCart() {
        // Save current stage first
        this.modules.stages.saveCurrentStageDesign?.();

        const designData = this.getDesignData();
        const thumbnail = this.canvas.toDataURL({ format: 'png', multiplier: 0.5 });

        // Calculate price
        const designObjects = this.canvas.getDesignObjects();
        const price = this.productLoader.calculatePrice(designObjects);

        this.events.emit('design:addToCart', {
            productId: this.currentProduct?.id,
            productName: this.currentProduct?.name,
            design: designData,
            thumbnail: thumbnail,
            price: price,
            viewsUsed: this.modules.stages.getDesignedStagesCount?.() || 1
        });

        alert(`Design added to cart! Price: $${price.toFixed(2)}`);
    }

    /**
     * Get current design data
     */
    getDesignData() {
        return {
            productId: this.currentProduct?.id,
            productName: this.currentProduct?.name,
            stages: this.modules.stages.getStagesData(),
            timestamp: Date.now()
        };
    }

    /**
     * Calculate current design price
     */
    calculatePrice() {
        const designObjects = this.canvas.getDesignObjects();
        return this.productLoader.calculatePrice(designObjects);
    }
}
