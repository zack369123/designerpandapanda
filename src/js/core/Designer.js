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

        // Set up color selector (in product controls)
        this.setupColorSelector();

        // Set up Order panel (colors + sizes + summary in sidebar)
        this.setupOrderPanel();

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

        // Update color swatches UI (product controls bar)
        const colors = this.productLoader.getColors();
        this.renderColorSwatches(colors);

        // Update Order panel colors
        this.renderOrderColors(colors);

        // Update Order panel sizes (quantities are per-color)
        const sizes = this.productLoader.getSizes();
        this.renderOrderSizes(sizes);

        // Reload the current view with new color's image
        this.events.emit('color:changed', { colorId, view });

        // Update the canvas with new mockup image
        this.canvas.setBackgroundImage(view.image, view.printArea);

        // Update all stages' images to use new color
        this.modules.stages.refreshStageImagesForColor(this.productLoader);

        console.log(`Switched to color: ${colorId}`);
    }

    /**
     * Set up Order panel (colors, sizes, summary in sidebar)
     */
    setupOrderPanel() {
        // Event delegation for Order panel color swatches
        const orderColorSwatches = document.getElementById('order-color-swatches');
        if (orderColorSwatches) {
            orderColorSwatches.addEventListener('click', (e) => {
                const swatch = e.target.closest('.order-color-swatch');
                if (!swatch) return;

                const colorId = swatch.dataset.colorId;
                if (colorId) {
                    this.switchColor(colorId);
                }
            });
        }

        // Event delegation for Order panel size quantity buttons
        const orderSizesGrid = document.getElementById('order-sizes-grid');
        if (orderSizesGrid) {
            orderSizesGrid.addEventListener('click', (e) => {
                const btn = e.target.closest('.order-qty-btn');
                if (!btn) return;

                const sizeId = btn.dataset.sizeId;
                const action = btn.dataset.action;

                if (sizeId && action) {
                    this.updateSizeQuantity(sizeId, action);
                }
            });
        }

        // Event delegation for Order panel VAS toggles
        const orderVasOptions = document.getElementById('order-vas-options');
        if (orderVasOptions) {
            orderVasOptions.addEventListener('click', (e) => {
                const vasItem = e.target.closest('.order-vas-item');
                if (!vasItem) return;

                const vasType = vasItem.dataset.vasType;
                if (vasType) {
                    this.toggleOrderVAS(vasType, vasItem);
                }
            });
        }
    }

    /**
     * Render colors in Order panel
     */
    renderOrderColors(colors) {
        const container = document.getElementById('order-color-swatches');
        const colorNameEl = document.getElementById('order-color-name');
        const colorSection = document.getElementById('order-color-section');

        if (!container) return;

        // Hide section if no colors or only one
        if (!colors || colors.length <= 1) {
            if (colorSection) colorSection.style.display = 'none';
            return;
        }

        if (colorSection) colorSection.style.display = 'block';

        // Helper to determine if a color is light
        const isLightColor = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 180;
        };

        container.innerHTML = colors.map(color => `
            <button
                class="order-color-swatch ${color.isActive ? 'active' : ''} ${isLightColor(color.colorCode) ? 'light-color' : ''}"
                data-color-id="${color.id}"
                style="background-color: ${color.colorCode}"
                title="${color.name}"
            ></button>
        `).join('');

        // Show active color name
        const activeColor = colors.find(c => c.isActive);
        if (colorNameEl && activeColor) {
            colorNameEl.textContent = activeColor.name;
        }
    }

    /**
     * Render size quantities in Order panel
     */
    renderOrderSizes(sizes) {
        const grid = document.getElementById('order-sizes-grid');
        const sizesSection = document.getElementById('order-sizes-section');
        const totalQtyEl = document.getElementById('order-total-qty-value');

        if (!grid) return;

        // Hide section if no sizes
        if (!sizes || sizes.length === 0) {
            if (sizesSection) sizesSection.style.display = 'none';
            return;
        }

        if (sizesSection) sizesSection.style.display = 'block';

        const quantities = this.productLoader.getSizeQuantities();
        let totalQty = 0;

        grid.innerHTML = sizes.map(size => {
            const qty = quantities[size.id] || 0;
            totalQty += qty;
            const hasQty = qty > 0;
            const upchargeText = size.upcharge > 0 ? `<span class="order-size-upcharge">+$${size.upcharge.toFixed(2)}</span>` : '';

            return `
                <div class="order-size-row ${hasQty ? 'has-qty' : ''}" data-size-id="${size.id}">
                    <div class="order-size-info">
                        <span class="order-size-name">${size.name}</span>
                        ${upchargeText}
                    </div>
                    <div class="order-size-controls">
                        <button class="order-qty-btn" data-size-id="${size.id}" data-action="decrease" ${qty === 0 ? 'disabled' : ''}>
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="order-qty-value">${qty}</span>
                        <button class="order-qty-btn" data-size-id="${size.id}" data-action="increase">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Update total quantity
        if (totalQtyEl) {
            totalQtyEl.textContent = totalQty;
        }

        // Update order summary
        this.renderOrderSummary();
    }

    /**
     * Render VAS options in Order panel
     */
    renderOrderVAS() {
        const container = document.getElementById('order-vas-options');
        const vasSection = document.getElementById('order-vas-section');

        if (!container || !this.currentProduct) return;

        const vas = this.currentProduct.vas;
        const selectedVAS = this.productLoader.getSelectedVAS();
        const pricing = this.productLoader.getPricing();
        const totalQty = this.productLoader.getTotalQuantity();

        // Check if any VAS is enabled for this product
        const hasFoldBag = vas?.foldAndBag?.enabled;
        const hasNeckTags = vas?.neckTags?.enabled;

        if (!hasFoldBag && !hasNeckTags) {
            if (vasSection) vasSection.style.display = 'none';
            return;
        }

        if (vasSection) vasSection.style.display = 'block';

        let html = '';

        // Fold & Bag
        if (hasFoldBag) {
            const isActive = selectedVAS.foldAndBag;
            const pricePerItem = pricing.foldAndBag || 0;
            const desc = vas.foldAndBag.description || 'Individual poly bag packaging';

            html += `
                <div class="order-vas-item ${isActive ? 'active' : ''}" data-vas-type="foldAndBag">
                    <div class="order-vas-checkbox">
                        <i class="fas fa-check"></i>
                    </div>
                    <div class="order-vas-content">
                        <div class="order-vas-header">
                            <span class="order-vas-name"><i class="fas fa-box-open"></i> Fold & Bag</span>
                            <span class="order-vas-price">+$${pricePerItem.toFixed(2)}/item</span>
                        </div>
                        <p class="order-vas-desc">${desc}</p>
                    </div>
                </div>
            `;
        }

        // Neck Tags
        if (hasNeckTags) {
            const isActive = selectedVAS.neckTags;
            const pricePerItem = pricing.neckTags || 0;
            const desc = vas.neckTags.description || 'Custom printed neck label';

            html += `
                <div class="order-vas-item ${isActive ? 'active' : ''}" data-vas-type="neckTags">
                    <div class="order-vas-checkbox">
                        <i class="fas fa-check"></i>
                    </div>
                    <div class="order-vas-content">
                        <div class="order-vas-header">
                            <span class="order-vas-name"><i class="fas fa-tag"></i> Neck Tags</span>
                            <span class="order-vas-price">+$${pricePerItem.toFixed(2)}/item</span>
                        </div>
                        <p class="order-vas-desc">${desc}</p>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Toggle VAS in Order panel
     */
    toggleOrderVAS(vasType, itemElement) {
        const isActive = itemElement.classList.contains('active');

        // For neck tags, check if any sizes have quantity > 0 across ALL colors
        if (vasType === 'neckTags' && !isActive) {
            const totalQty = this.productLoader.getTotalQuantity();
            if (totalQty === 0) {
                alert('You need to select some quantities first before enabling this service.');
                return;
            }
        }

        // Toggle state
        if (vasType === 'foldAndBag') {
            this.productLoader.toggleFoldAndBag(!isActive);
        } else if (vasType === 'neckTags') {
            this.productLoader.toggleNeckTags(!isActive);
        }

        itemElement.classList.toggle('active');
        this.events.emit('vas:changed', { vasType, enabled: !isActive });

        // Update order summary to reflect VAS changes
        this.renderOrderSummary();

        // Also update the VAS panel (Services tab)
        this.renderVASPanel();
    }

    /**
     * Render order summary with pricing (shows all colors with their sizes)
     */
    renderOrderSummary() {
        const linesContainer = document.getElementById('order-summary-lines');
        const totalEl = document.getElementById('order-summary-total');
        const rightPriceEl = document.getElementById('total-price');

        if (!linesContainer || !this.currentProduct) return;

        // Get full order details across all colors
        const orderLines = this.productLoader.getFullOrderDetails();
        const selectedVAS = this.productLoader.getSelectedVAS();
        const vas = this.currentProduct.vas || {};
        const pricing = this.productLoader.getPricing(); // Global pricing rules

        let lines = [];
        let subtotal = 0;
        let totalQty = 0;

        // Group by color for display
        const colorGroups = {};
        orderLines.forEach(line => {
            if (!colorGroups[line.colorId]) {
                colorGroups[line.colorId] = {
                    colorName: line.colorName,
                    colorCode: line.colorCode,
                    items: []
                };
            }
            colorGroups[line.colorId].items.push(line);
        });

        // Calculate per-color/size totals
        for (const colorId in colorGroups) {
            const group = colorGroups[colorId];

            // Add color header
            lines.push(`
                <div class="order-summary-line color-header">
                    <span><span class="color-dot" style="background:${group.colorCode}"></span>${group.colorName}</span>
                </div>
            `);

            group.items.forEach(item => {
                totalQty += item.quantity;
                const basePrice = this.currentProduct.price || 0;
                const lineTotal = item.quantity * (basePrice + item.upcharge);
                subtotal += lineTotal;

                lines.push(`
                    <div class="order-summary-line size-line">
                        <span>${item.sizeName} × ${item.quantity}</span>
                        <span>$${lineTotal.toFixed(2)}</span>
                    </div>
                `);
            });
        }

        // Add view pricing (additional views)
        const viewsPricing = this.calculateViewsPricing();
        if (viewsPricing.total > 0) {
            subtotal += viewsPricing.total;
            lines.push(`
                <div class="order-summary-line vas-line">
                    <span>Print Locations (${viewsPricing.count} extra)</span>
                    <span>$${viewsPricing.total.toFixed(2)}</span>
                </div>
            `);
        }

        // Add VAS if selected (using GLOBAL pricing)
        if (selectedVAS.foldAndBag && vas?.foldAndBag?.enabled && totalQty > 0) {
            const vasPrice = pricing.foldAndBag || 0;
            const vasTotal = totalQty * vasPrice;
            subtotal += vasTotal;
            lines.push(`
                <div class="order-summary-line vas-line">
                    <span>Fold & Bag × ${totalQty}</span>
                    <span>$${vasTotal.toFixed(2)}</span>
                </div>
            `);
        }

        if (selectedVAS.neckTags && vas?.neckTags?.enabled && totalQty > 0) {
            const vasPrice = pricing.neckTags || 0;
            const vasTotal = totalQty * vasPrice;
            subtotal += vasTotal;
            lines.push(`
                <div class="order-summary-line vas-line">
                    <span>Neck Tags × ${totalQty}</span>
                    <span>$${vasTotal.toFixed(2)}</span>
                </div>
            `);
        }

        // Render lines
        if (lines.length === 0) {
            linesContainer.innerHTML = '<div class="order-summary-line"><span>No items selected</span></div>';
        } else {
            linesContainer.innerHTML = lines.join('');
        }

        // Update totals
        if (totalEl) {
            totalEl.textContent = `$${subtotal.toFixed(2)}`;
        }

        // Also update the right sidebar price
        if (rightPriceEl) {
            rightPriceEl.textContent = `$${subtotal.toFixed(2)}`;
        }
    }

    /**
     * Calculate pricing for additional views/print locations
     * First view = free, additional views = additionalView price
     * Views marked "always charge" = charge their extraPrice
     */
    calculateViewsPricing() {
        if (!this.currentProduct || !this.modules.stages) {
            return { count: 0, total: 0 };
        }

        const pricing = this.productLoader.getPricing();
        const additionalViewPrice = pricing.additionalView || 0;

        // Get views that have design content
        const designedViews = this.modules.stages.getDesignedStages?.() || [];
        const views = this.currentProduct.views || [];

        let total = 0;
        let additionalCount = 0;
        let isFirstView = true;

        designedViews.forEach(stageId => {
            const view = views.find(v => v.id === stageId);
            if (!view) return;

            // Views marked "always charge extra" - charge regardless
            if (view.alwaysChargeExtra) {
                total += view.extraPrice || 0;
            } else {
                // First regular view is free, additional views cost additionalViewPrice
                if (isFirstView) {
                    isFirstView = false;
                } else {
                    total += additionalViewPrice;
                    additionalCount++;
                }
            }
        });

        return { count: additionalCount, total };
    }

    /**
     * Update quantity for a size
     */
    updateSizeQuantity(sizeId, action) {
        const quantities = this.productLoader.getSizeQuantities();
        let currentQty = quantities[sizeId] || 0;

        if (action === 'increase') {
            currentQty++;
        } else if (action === 'decrease' && currentQty > 0) {
            currentQty--;
        }

        this.productLoader.setSizeQuantity(sizeId, currentQty);

        // Re-render Order panel sizes
        const sizes = this.productLoader.getSizes();
        this.renderOrderSizes(sizes);

        // Re-render VAS panel (neck tags depend on selected sizes)
        this.renderVASPanel();

        // Emit event
        this.events.emit('size:quantityChanged', { sizeId, quantity: currentQty });
    }

    /**
     * Get sizes that have quantity > 0 (for current color)
     */
    getSelectedSizes() {
        const sizes = this.productLoader.getSizes();
        const quantities = this.productLoader.getSizeQuantities();

        return sizes.filter(size => (quantities[size.id] || 0) > 0);
    }

    /**
     * Get all sizes that have quantity > 0 across ALL colors (for neck tags)
     */
    getAllSelectedSizes() {
        return this.productLoader.getAllSelectedSizes();
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
     * Render VAS panel for current product (Services tab)
     */
    renderVASPanel() {
        const container = document.getElementById('vas-services-list');
        if (!container) return;

        const vas = this.productLoader.getVAS();
        const selectedVAS = this.productLoader.getSelectedVAS();
        const pricing = this.productLoader.getPricing(); // Global pricing

        // Get ALL sizes that have quantity > 0 across ALL colors (for neck tags)
        const allSelectedSizes = this.getAllSelectedSizes();
        const hasSelectedSizes = allSelectedSizes.length > 0;

        if (!vas) {
            container.innerHTML = '<div class="vas-loading"><p>Select a product to see available services</p></div>';
            return;
        }

        let html = '';

        // Fold & Bag
        if (vas.foldAndBag && vas.foldAndBag.enabled) {
            const isActive = selectedVAS.foldAndBag;
            const pricePerItem = pricing.foldAndBag || 0;
            html += `
                <div class="vas-service-item ${isActive ? 'active' : ''}" data-service="foldAndBag">
                    <div class="vas-service-header">
                        <div class="vas-service-info">
                            <i class="fas fa-box-open"></i>
                            <span class="vas-service-name">Fold & Bag</span>
                        </div>
                        <span class="vas-service-price">+$${pricePerItem.toFixed(2)}/item</span>
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
            const pricePerItem = pricing.neckTags || 0;

            html += `
                <div class="vas-service-item ${isActive ? 'active' : ''}" data-service="neckTags">
                    <div class="vas-service-header">
                        <div class="vas-service-info">
                            <i class="fas fa-tag"></i>
                            <span class="vas-service-name">Neck Tags</span>
                        </div>
                        <span class="vas-service-price">+$${pricePerItem.toFixed(2)}/item</span>
                    </div>
                    <div class="vas-service-body">
                        <p class="vas-service-desc">${vas.neckTags.description || 'Custom printed neck label for each item.'}</p>
                        ${hasSelectedSizes ? this.renderNeckTagsSizes(allSelectedSizes, selectedVAS.neckTagImages) : `
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

        // For neck tags, check if any sizes have quantity > 0 across ALL colors
        if (serviceType === 'neckTags' && !isActive) {
            const allSelectedSizes = this.getAllSelectedSizes();
            if (allSelectedSizes.length === 0) {
                alert('You need to pick some sizes first before using this function.');
                return;
            }
        }

        // Toggle state
        if (serviceType === 'foldAndBag') {
            this.productLoader.toggleFoldAndBag(!isActive);
        } else if (serviceType === 'neckTags') {
            this.productLoader.toggleNeckTags(!isActive);
        }

        itemElement.classList.toggle('active');
        this.events.emit('vas:changed', { serviceType, enabled: !isActive });

        // Update order summary to reflect VAS changes
        this.renderOrderSummary();
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

        // Render color swatches (product controls bar)
        this.renderColorSwatches(productData.colors);

        // Render Order panel (sidebar)
        this.renderOrderColors(productData.colors);
        this.renderOrderSizes(productData.sizes);
        this.renderOrderVAS();

        // Render VAS panel (Services tab)
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

        // Handle window resize for responsive canvas
        this.setupResponsiveCanvas();

        // Listen for mobile events
        document.addEventListener('mobile:resize', (e) => {
            this.handleMobileResize(e.detail);
        });
    }

    /**
     * Set up responsive canvas handling
     */
    setupResponsiveCanvas() {
        let resizeTimeout;

        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.fitCanvasToContainer();
            }, 150);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', () => {
            setTimeout(handleResize, 300);
        });

        // Initial fit
        setTimeout(() => this.fitCanvasToContainer(), 100);
    }

    /**
     * Fit canvas to its container
     */
    fitCanvasToContainer() {
        const container = document.getElementById('canvas-container');
        const wrapper = document.getElementById('canvas-wrapper');
        const fabricCanvas = this.canvas?.fabricCanvas;
        if (!container || !wrapper || !fabricCanvas) return;

        const isMobile = window.innerWidth < 768;
        const padding = isMobile ? 16 : 32;
        const bottomNavHeight = isMobile ? 56 : 0;

        const containerWidth = container.clientWidth - (padding * 2);
        const containerHeight = container.clientHeight - (padding * 2) - bottomNavHeight;

        const canvasWidth = fabricCanvas.getWidth();
        const canvasHeight = fabricCanvas.getHeight();

        // Calculate scale to fit
        const scaleX = containerWidth / canvasWidth;
        const scaleY = containerHeight / canvasHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

        if (scale < 1) {
            wrapper.style.transform = `scale(${scale})`;
            wrapper.style.transformOrigin = 'center center';
        } else {
            wrapper.style.transform = '';
        }
    }

    /**
     * Handle mobile resize events from MobileManager
     */
    handleMobileResize(detail) {
        this.fitCanvasToContainer();
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
