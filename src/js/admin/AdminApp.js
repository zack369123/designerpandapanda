/**
 * AdminApp - Main admin panel controller
 */

import { dataStore } from './DataStore.js';
import { PrintAreaEditor } from './PrintAreaEditor.js';

class AdminApp {
    constructor() {
        this.store = dataStore;
        this.currentSection = 'dashboard';
        this.printAreaEditor = null;

        // Product views data (temporary storage while editing)
        this.productViews = [];
        this.currentViewIndex = 0;

        // Product colors data
        this.productColors = [];
        this.currentColorIndex = 0;

        // Product sizes data
        this.productSizes = [];

        // Product Value Added Services data (pricing is global, only enable/disable per product)
        this.productVAS = {
            foldAndBag: { enabled: false, description: '' },
            neckTags: { enabled: false, description: '' }
        };

        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupModals();
        this.setupModalTabs();
        this.setupProducts();
        this.setupSettings();
        this.setupDashboard();
        this.setupPrintAreaEditor();
        this.setupColors();
        this.setupSizes();
        this.setupVAS();

        this.updateStats();
    }

    // =========================================================================
    // Navigation
    // =========================================================================

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.showSection(section);
            });
        });

        // Quick action buttons
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleAction(e.currentTarget.dataset.action);
            });
        });
    }

    showSection(sectionId) {
        this.currentSection = sectionId;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        // Update sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.toggle('active', section.dataset.section === sectionId);
        });

        // Update title
        const titles = {
            dashboard: 'Dashboard',
            products: 'Products',
            templates: 'Templates',
            fonts: 'Fonts',
            pricing: 'Pricing Rules',
            orders: 'Orders',
            settings: 'Settings'
        };
        document.getElementById('section-title').textContent = titles[sectionId] || sectionId;

        // Load section data
        this.loadSectionData(sectionId);
    }

    loadSectionData(section) {
        switch (section) {
            case 'dashboard':
                this.updateStats();
                break;
            case 'products':
                this.renderProducts();
                break;
            case 'templates':
                this.renderTemplates();
                break;
            case 'fonts':
                this.renderFonts();
                break;
            case 'orders':
                this.renderOrders();
                break;
            case 'pricing':
                this.loadPricing();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    handleAction(action) {
        switch (action) {
            case 'new-product':
                this.showSection('products');
                this.openProductModal();
                break;
            case 'new-template':
                this.showSection('templates');
                // TODO: Open template editor
                break;
        }
    }

    // =========================================================================
    // Modals
    // =========================================================================

    setupModals() {
        // Close modal on backdrop click or close button
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                this.closeModal(modal);
            });
        });
    }

    openModal(modalId) {
        document.getElementById(modalId)?.classList.add('open');
    }

    closeModal(modal) {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        modal?.classList.remove('open');
    }

    // =========================================================================
    // Modal Tabs
    // =========================================================================

    setupModalTabs() {
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = tab.dataset.tab;
                const modal = tab.closest('.modal');

                // Update tab buttons
                modal.querySelectorAll('.modal-tab').forEach(t => {
                    t.classList.toggle('active', t.dataset.tab === tabId);
                });

                // Update tab content
                modal.querySelectorAll('.modal-tab-content').forEach(content => {
                    content.classList.toggle('active', content.dataset.tabContent === tabId);
                });

                // Initialize print area editor when switching to that tab
                if (tabId === 'print-areas' && this.printAreaEditor) {
                    this.renderViewsList();
                }
            });
        });
    }

    // =========================================================================
    // Print Area Editor
    // =========================================================================

    setupPrintAreaEditor() {
        // Initialize the print area editor
        this.printAreaEditor = new PrintAreaEditor('print-area-canvas', {
            maxWidth: 500,
            maxHeight: 380
        });

        // Add view button
        document.getElementById('add-view-btn')?.addEventListener('click', () => {
            this.addProductView();
        });

        // Upload view image button
        document.getElementById('upload-view-image-btn')?.addEventListener('click', () => {
            document.getElementById('view-image-input')?.click();
        });

        // Handle view image upload
        document.getElementById('view-image-input')?.addEventListener('change', (e) => {
            this.handleViewImageUpload(e.target.files[0]);
        });

        // Print area dimension inputs
        document.getElementById('print-area-width')?.addEventListener('change', () => {
            this.updateCurrentViewData();
        });
        document.getElementById('print-area-height')?.addEventListener('change', () => {
            this.updateCurrentViewData();
        });

        // View pricing inputs
        document.getElementById('view-always-charge')?.addEventListener('change', (e) => {
            const priceGroup = document.getElementById('view-extra-price-group');
            if (priceGroup) {
                priceGroup.style.display = e.target.checked ? 'block' : 'none';
            }
            this.updateCurrentViewData();
        });
        document.getElementById('view-extra-price')?.addEventListener('change', () => {
            this.updateCurrentViewData();
        });

        // Listen for print area changes from the editor
        this.printAreaEditor.onChange((data) => {
            this.updateCurrentViewData();
        });
    }

    /**
     * Initialize views for a new product
     */
    initializeViews() {
        this.productViews = [{
            id: this.generateViewId(),
            name: 'Front',
            printArea: {
                widthPercent: 40,
                heightPercent: 50,
                leftPercent: 0,
                topPercent: 0,
                printWidthInches: 8,
                printHeightInches: 10
            },
            alwaysChargeExtra: false,
            extraPrice: 0
        }];
        this.currentViewIndex = 0;
    }

    /**
     * Initialize colors for a new product
     */
    initializeColors() {
        const defaultViewId = this.productViews[0]?.id;
        this.productColors = [{
            id: this.generateColorId(),
            name: 'Default',
            colorCode: '#ffffff',
            viewImages: {} // { viewId: imageDataUrl }
        }];
        this.currentColorIndex = 0;
    }

    /**
     * Add a new product view
     */
    addProductView() {
        const viewNumber = this.productViews.length + 1;
        const newView = {
            id: this.generateViewId(),
            name: viewNumber === 2 ? 'Back' : `View ${viewNumber}`,
            printArea: {
                widthPercent: 40,
                heightPercent: 50,
                leftPercent: 0,
                topPercent: 0,
                printWidthInches: 8,
                printHeightInches: 10
            },
            alwaysChargeExtra: false,
            extraPrice: 0
        };
        this.productViews.push(newView);
        this.renderViewsList();
        this.selectView(this.productViews.length - 1);
    }

    /**
     * Remove a product view
     */
    removeProductView(index) {
        if (this.productViews.length <= 1) {
            alert('You must have at least one view.');
            return;
        }
        this.productViews.splice(index, 1);
        if (this.currentViewIndex >= this.productViews.length) {
            this.currentViewIndex = this.productViews.length - 1;
        }
        this.renderViewsList();
        this.selectView(this.currentViewIndex);
    }

    /**
     * Select a view for editing
     */
    selectView(index) {
        this.currentViewIndex = index;
        const view = this.productViews[index];

        // Update UI
        document.querySelectorAll('#views-list .view-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });

        // Get image from current color for this view
        const currentColor = this.productColors[this.currentColorIndex];
        const viewImage = currentColor?.viewImages?.[view.id] || null;

        // Load image into editor if exists
        if (viewImage) {
            this.printAreaEditor.loadProductImage(viewImage).then(() => {
                if (view.printArea) {
                    this.printAreaEditor.setPrintAreaData(view.printArea);
                }
            });
            document.getElementById('print-area-placeholder')?.classList.add('hidden');
        } else {
            this.printAreaEditor.showPlaceholder();
            document.getElementById('print-area-placeholder')?.classList.remove('hidden');
        }

        // Update print size inputs
        document.getElementById('print-area-width').value = view.printArea?.printWidthInches || 8;
        document.getElementById('print-area-height').value = view.printArea?.printHeightInches || 10;

        // Update view pricing inputs
        const alwaysChargeCheckbox = document.getElementById('view-always-charge');
        const extraPriceInput = document.getElementById('view-extra-price');
        const extraPriceGroup = document.getElementById('view-extra-price-group');

        if (alwaysChargeCheckbox) {
            alwaysChargeCheckbox.checked = view.alwaysChargeExtra || false;
        }
        if (extraPriceInput) {
            extraPriceInput.value = view.extraPrice || 0;
        }
        if (extraPriceGroup) {
            extraPriceGroup.style.display = view.alwaysChargeExtra ? 'block' : 'none';
        }
    }

    /**
     * Render the views list in the sidebar
     */
    renderViewsList() {
        const container = document.getElementById('views-list');
        if (!container) return;

        const currentColor = this.productColors[this.currentColorIndex];

        container.innerHTML = this.productViews.map((view, index) => {
            const viewImage = currentColor?.viewImages?.[view.id] || null;
            return `
            <div class="view-item ${index === this.currentViewIndex ? 'active' : ''}" data-index="${index}">
                <div class="view-thumb">
                    ${viewImage
                        ? `<img src="${viewImage}" alt="${view.name}">`
                        : `<i class="fas fa-image"></i>`
                    }
                </div>
                <div class="view-info">
                    <input type="text" class="view-name-input" value="${view.name}" data-index="${index}">
                    <div class="view-status ${viewImage ? 'has-image' : ''}">
                        ${viewImage ? 'Image set' : 'No image'}
                    </div>
                </div>
                <button type="button" class="btn-icon btn-remove-view" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `}).join('');

        // Attach click handlers
        container.querySelectorAll('.view-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-remove-view') && !e.target.closest('.view-name-input')) {
                    this.selectView(parseInt(item.dataset.index));
                }
            });
        });

        // View name inputs
        container.querySelectorAll('.view-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.productViews[index].name = e.target.value;
            });
            input.addEventListener('click', (e) => e.stopPropagation());
        });

        // Remove buttons
        container.querySelectorAll('.btn-remove-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeProductView(parseInt(btn.dataset.index));
            });
        });
    }

    /**
     * Handle view image upload - compresses image to fit in localStorage
     * Stores image in current color's viewImages for current view
     */
    handleViewImageUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Compress image to reduce storage size
                const compressedData = this.compressImage(img, 800, 0.7);

                // Store in current color's viewImages
                const currentView = this.productViews[this.currentViewIndex];
                const currentColor = this.productColors[this.currentColorIndex];

                if (currentColor && currentView) {
                    if (!currentColor.viewImages) {
                        currentColor.viewImages = {};
                    }
                    currentColor.viewImages[currentView.id] = compressedData;
                }

                // Load into editor
                this.printAreaEditor.loadProductImage(compressedData).then(() => {
                    this.renderViewsList();
                    this.renderColorsList();
                });

                console.log(`Image compressed: ${(e.target.result.length / 1024).toFixed(0)}KB -> ${(compressedData.length / 1024).toFixed(0)}KB`);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Compress image to reduce storage size
     * @param {HTMLImageElement} img - Source image
     * @param {number} maxSize - Maximum width/height in pixels
     * @param {number} quality - JPEG quality (0-1)
     * @returns {string} Compressed base64 data URL
     */
    compressImage(img, maxSize = 800, quality = 0.7) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = (height / width) * maxSize;
                width = maxSize;
            } else {
                width = (width / height) * maxSize;
                height = maxSize;
            }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Use JPEG for smaller file size (PNG is lossless and larger)
        return canvas.toDataURL('image/jpeg', quality);
    }

    /**
     * Update current view data from editor
     */
    updateCurrentViewData() {
        if (!this.productViews[this.currentViewIndex]) return;

        const printAreaData = this.printAreaEditor.getPrintAreaData();
        if (printAreaData) {
            this.productViews[this.currentViewIndex].printArea = printAreaData;
        }

        // Also update from inputs
        this.productViews[this.currentViewIndex].printArea.printWidthInches =
            parseFloat(document.getElementById('print-area-width')?.value) || 8;
        this.productViews[this.currentViewIndex].printArea.printHeightInches =
            parseFloat(document.getElementById('print-area-height')?.value) || 10;

        // Update view pricing
        this.productViews[this.currentViewIndex].alwaysChargeExtra =
            document.getElementById('view-always-charge')?.checked || false;
        this.productViews[this.currentViewIndex].extraPrice =
            parseFloat(document.getElementById('view-extra-price')?.value) || 0;
    }

    /**
     * Generate unique view ID
     */
    generateViewId() {
        return 'view_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    /**
     * Generate unique color ID
     */
    generateColorId() {
        return 'color_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    // =========================================================================
    // Color Management
    // =========================================================================

    setupColors() {
        // Add color button
        document.getElementById('add-color-btn')?.addEventListener('click', () => {
            this.addProductColor();
        });
    }

    /**
     * Add a new product color
     */
    addProductColor() {
        const colorNumber = this.productColors.length + 1;
        const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

        const newColor = {
            id: this.generateColorId(),
            name: `Color ${colorNumber}`,
            colorCode: randomColor,
            viewImages: {}
        };
        this.productColors.push(newColor);
        this.renderColorsList();
        this.selectColor(this.productColors.length - 1);
    }

    /**
     * Remove a product color
     */
    removeProductColor(index) {
        if (this.productColors.length <= 1) {
            alert('You must have at least one color.');
            return;
        }
        this.productColors.splice(index, 1);
        if (this.currentColorIndex >= this.productColors.length) {
            this.currentColorIndex = this.productColors.length - 1;
        }
        this.renderColorsList();
        this.selectColor(this.currentColorIndex);
    }

    /**
     * Select a color for editing
     */
    selectColor(index) {
        this.currentColorIndex = index;

        // Update UI
        document.querySelectorAll('#colors-list .color-item').forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });

        // Re-render views list to show images for this color
        this.renderViewsList();

        // Reload current view with new color's image
        this.selectView(this.currentViewIndex);
    }

    /**
     * Render the colors list
     */
    renderColorsList() {
        const container = document.getElementById('colors-list');
        if (!container) return;

        container.innerHTML = this.productColors.map((color, index) => {
            const imageCount = Object.keys(color.viewImages || {}).length;
            return `
            <div class="color-item ${index === this.currentColorIndex ? 'active' : ''}" data-index="${index}">
                <input type="color" class="color-picker" value="${color.colorCode}" data-index="${index}">
                <div class="color-info">
                    <input type="text" class="color-name-input" value="${color.name}" data-index="${index}">
                    <div class="color-code">${imageCount}/${this.productViews.length} images</div>
                </div>
                <button type="button" class="btn-icon btn-remove-color" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `}).join('');

        // Attach click handlers
        container.querySelectorAll('.color-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-remove-color') &&
                    !e.target.closest('.color-name-input') &&
                    !e.target.closest('.color-picker')) {
                    this.selectColor(parseInt(item.dataset.index));
                }
            });
        });

        // Color name inputs
        container.querySelectorAll('.color-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.productColors[index].name = e.target.value;
            });
            input.addEventListener('click', (e) => e.stopPropagation());
        });

        // Color picker inputs
        container.querySelectorAll('.color-picker').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.productColors[index].colorCode = e.target.value;
            });
            input.addEventListener('click', (e) => e.stopPropagation());
        });

        // Remove buttons
        container.querySelectorAll('.btn-remove-color').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeProductColor(parseInt(btn.dataset.index));
            });
        });
    }

    // =========================================================================
    // Size Management
    // =========================================================================

    setupSizes() {
        // Add custom size button
        document.getElementById('add-size-btn')?.addEventListener('click', () => {
            this.addProductSize();
        });

        // Clear all sizes button
        document.getElementById('clear-sizes-btn')?.addEventListener('click', () => {
            if (confirm('Remove all sizes?')) {
                this.productSizes = [];
                this.renderSizesList();
            }
        });

        // Size preset buttons
        document.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                this.addSizePreset(preset);
            });
        });
    }

    /**
     * Size presets definitions
     */
    sizePresets = {
        'adult': ['S', 'M', 'L', 'XL', '2XL', '3XL'],
        'adult-extended': ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
        'youth': ['YS', 'YM', 'YL', 'YXL'],
        'numeric': ['0', '2', '4', '6', '8', '10', '12', '14']
    };

    /**
     * Add a preset of sizes
     */
    addSizePreset(presetName) {
        const preset = this.sizePresets[presetName];
        if (!preset) return;

        // Get existing size names
        const existingNames = this.productSizes.map(s => s.name.toUpperCase());

        // Add sizes that don't already exist
        let addedCount = 0;
        preset.forEach(sizeName => {
            if (!existingNames.includes(sizeName.toUpperCase())) {
                this.productSizes.push({
                    id: this.generateSizeId(),
                    name: sizeName,
                    upcharge: 0
                });
                addedCount++;
            }
        });

        this.renderSizesList();

        if (addedCount === 0) {
            console.log('All sizes from this preset already exist');
        } else {
            console.log(`Added ${addedCount} sizes`);
        }
    }

    /**
     * Initialize sizes for a new product
     */
    initializeSizes() {
        this.productSizes = [];
    }

    /**
     * Add a new product size
     */
    addProductSize() {
        const commonSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
        const usedSizes = this.productSizes.map(s => s.name);
        const nextSize = commonSizes.find(s => !usedSizes.includes(s)) || `Size ${this.productSizes.length + 1}`;

        const newSize = {
            id: this.generateSizeId(),
            name: nextSize,
            upcharge: 0
        };
        this.productSizes.push(newSize);
        this.renderSizesList();
    }

    /**
     * Remove a product size
     */
    removeProductSize(index) {
        this.productSizes.splice(index, 1);
        this.renderSizesList();
    }

    /**
     * Generate unique size ID
     */
    generateSizeId() {
        return 'size_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    /**
     * Render the sizes list
     */
    renderSizesList() {
        const container = document.getElementById('sizes-list');
        if (!container) return;

        if (this.productSizes.length === 0) {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-ruler"></i>
                    <p>No sizes added yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.productSizes.map((size, index) => `
            <div class="size-item" data-index="${index}">
                <input type="text" class="size-name-input" value="${size.name}" data-index="${index}" placeholder="Size name">
                <div class="size-upcharge-group">
                    <label>Upcharge: $</label>
                    <input type="number" class="size-upcharge-input" value="${size.upcharge}" data-index="${index}" step="0.01" min="0">
                </div>
                <button type="button" class="btn-icon btn-remove-size" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        // Attach event handlers
        container.querySelectorAll('.size-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.productSizes[index].name = e.target.value;
            });
        });

        container.querySelectorAll('.size-upcharge-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.productSizes[index].upcharge = parseFloat(e.target.value) || 0;
            });
        });

        container.querySelectorAll('.btn-remove-size').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeProductSize(parseInt(btn.dataset.index));
            });
        });
    }

    // =========================================================================
    // Value Added Services Management
    // =========================================================================

    setupVAS() {
        // Fold & Bag toggle
        const foldBagCheckbox = document.getElementById('vas-fold-bag-enabled');
        foldBagCheckbox?.addEventListener('change', (e) => {
            this.productVAS.foldAndBag.enabled = e.target.checked;
            this.updateVASCardState('vas-fold-bag', e.target.checked);
        });

        // Fold & Bag description
        document.getElementById('vas-fold-bag-desc')?.addEventListener('change', (e) => {
            this.productVAS.foldAndBag.description = e.target.value;
        });

        // Neck Tags toggle
        const neckTagsCheckbox = document.getElementById('vas-neck-tags-enabled');
        neckTagsCheckbox?.addEventListener('change', (e) => {
            this.productVAS.neckTags.enabled = e.target.checked;
            this.updateVASCardState('vas-neck-tags', e.target.checked);
        });

        // Neck Tags description
        document.getElementById('vas-neck-tags-desc')?.addEventListener('change', (e) => {
            this.productVAS.neckTags.description = e.target.value;
        });
    }

    /**
     * Update VAS card visual state
     */
    updateVASCardState(prefix, enabled) {
        const card = document.getElementById(prefix + '-enabled')?.closest('.vas-card');
        if (card) {
            card.classList.toggle('active', enabled);
        }
    }

    /**
     * Initialize VAS for a new product
     */
    initializeVAS() {
        this.productVAS = {
            foldAndBag: { enabled: false, description: '' },
            neckTags: { enabled: false, description: '' }
        };
    }

    /**
     * Load VAS data into form
     */
    loadVASForm() {
        // Fold & Bag
        const foldBagEnabled = document.getElementById('vas-fold-bag-enabled');
        if (foldBagEnabled) {
            foldBagEnabled.checked = this.productVAS.foldAndBag.enabled;
            this.updateVASCardState('vas-fold-bag', this.productVAS.foldAndBag.enabled);
        }
        const foldBagDesc = document.getElementById('vas-fold-bag-desc');
        if (foldBagDesc) {
            foldBagDesc.value = this.productVAS.foldAndBag.description || '';
        }

        // Neck Tags
        const neckTagsEnabled = document.getElementById('vas-neck-tags-enabled');
        if (neckTagsEnabled) {
            neckTagsEnabled.checked = this.productVAS.neckTags.enabled;
            this.updateVASCardState('vas-neck-tags', this.productVAS.neckTags.enabled);
        }
        const neckTagsDesc = document.getElementById('vas-neck-tags-desc');
        if (neckTagsDesc) {
            neckTagsDesc.value = this.productVAS.neckTags.description || '';
        }
    }

    // =========================================================================
    // Dashboard
    // =========================================================================

    setupDashboard() {
        this.updateStats();
    }

    updateStats() {
        const stats = this.store.getStats();
        document.getElementById('stat-products').textContent = stats.products;
        document.getElementById('stat-templates').textContent = stats.templates;
        document.getElementById('stat-orders').textContent = stats.orders;
    }

    // =========================================================================
    // Products
    // =========================================================================

    setupProducts() {
        document.getElementById('add-product-btn')?.addEventListener('click', () => {
            this.openProductModal();
        });

        document.getElementById('save-product-btn')?.addEventListener('click', () => {
            this.saveProduct();
        });

        // Add view button
        document.getElementById('add-view-btn')?.addEventListener('click', () => {
            this.addProductView();
        });

        // Image upload
        const imageUpload = document.getElementById('product-image-upload');
        const imageInput = document.getElementById('product-image-input');

        imageUpload?.addEventListener('click', () => imageInput?.click());
        imageInput?.addEventListener('change', (e) => this.handleProductImage(e));
    }

    openProductModal(product = null) {
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('product-modal-title');

        // Reset form
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';

        // Reset to first tab
        modal.querySelectorAll('.modal-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === 'basic-info');
        });
        modal.querySelectorAll('.modal-tab-content').forEach(c => {
            c.classList.toggle('active', c.dataset.tabContent === 'basic-info');
        });

        // Initialize or load views and colors
        if (product) {
            title.textContent = 'Edit Product';
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-sku').value = product.sku || '';
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-price').value = product.price || 0;
            document.getElementById('product-category').value = product.category || 'other';
            document.getElementById('product-dpi').value = product.dpi || 300;

            // Load views with print areas (no image in view anymore)
            if (product.views && product.views.length > 0) {
                this.productViews = product.views.map(v => ({
                    id: v.id || this.generateViewId(),
                    name: v.name || 'Untitled',
                    printArea: v.printArea || {
                        widthPercent: 40,
                        heightPercent: 50,
                        leftPercent: 0,
                        topPercent: 0,
                        printWidthInches: 8,
                        printHeightInches: 10
                    },
                    alwaysChargeExtra: v.alwaysChargeExtra || false,
                    extraPrice: v.extraPrice || 0
                }));
            } else {
                this.initializeViews();
            }

            // Load colors
            if (product.colors && product.colors.length > 0) {
                this.productColors = product.colors.map(c => ({
                    id: c.id || this.generateColorId(),
                    name: c.name || 'Default',
                    colorCode: c.colorCode || '#ffffff',
                    viewImages: c.viewImages || {}
                }));
            } else {
                // Migration: if old product has images in views, convert to color
                this.initializeColors();
                // Check for legacy view images
                if (product.views?.some(v => v.image)) {
                    product.views.forEach(v => {
                        if (v.image) {
                            this.productColors[0].viewImages[v.id] = v.image;
                        }
                    });
                }
            }
            // Load sizes
            if (product.sizes && product.sizes.length > 0) {
                this.productSizes = product.sizes.map(s => ({
                    id: s.id || this.generateSizeId(),
                    name: s.name || '',
                    upcharge: s.upcharge || 0
                }));
            } else {
                this.initializeSizes();
            }

            // Load VAS (pricing is global now, only enable/disable per product)
            if (product.vas) {
                this.productVAS = {
                    foldAndBag: {
                        enabled: product.vas.foldAndBag?.enabled || false,
                        description: product.vas.foldAndBag?.description || ''
                    },
                    neckTags: {
                        enabled: product.vas.neckTags?.enabled || false,
                        description: product.vas.neckTags?.description || ''
                    }
                };
            } else {
                this.initializeVAS();
            }
        } else {
            title.textContent = 'Add Product';
            this.initializeViews();
            this.initializeColors();
            this.initializeSizes();
            this.initializeVAS();
        }

        this.currentViewIndex = 0;
        this.currentColorIndex = 0;
        this.renderViewsList();
        this.renderColorsList();
        this.renderSizesList();
        this.loadVASForm();

        // Show placeholder in print area editor
        this.printAreaEditor.showPlaceholder();
        document.getElementById('print-area-placeholder')?.classList.remove('hidden');

        this.openModal('product-modal');
    }

    saveProduct() {
        // Make sure current view data is saved
        this.updateCurrentViewData();

        const id = document.getElementById('product-id').value;

        const product = {
            id: id || null,
            name: document.getElementById('product-name').value,
            sku: document.getElementById('product-sku').value,
            description: document.getElementById('product-description').value,
            price: parseFloat(document.getElementById('product-price').value) || 0,
            category: document.getElementById('product-category').value,
            dpi: parseInt(document.getElementById('product-dpi').value) || 300,
            views: this.productViews.map(v => ({
                id: v.id,
                name: v.name,
                printArea: v.printArea,
                alwaysChargeExtra: v.alwaysChargeExtra || false,
                extraPrice: v.extraPrice || 0
            })),
            colors: this.productColors.map(c => ({
                id: c.id,
                name: c.name,
                colorCode: c.colorCode,
                viewImages: c.viewImages || {}
            })),
            sizes: this.productSizes.map(s => ({
                id: s.id,
                name: s.name,
                upcharge: s.upcharge || 0
            })),
            vas: {
                foldAndBag: { ...this.productVAS.foldAndBag },
                neckTags: { ...this.productVAS.neckTags }
            }
        };

        if (!product.name) {
            alert('Product name is required');
            return;
        }

        // Validate at least one color has an image for at least one view
        const hasImage = product.colors.some(c => Object.keys(c.viewImages || {}).length > 0);
        if (!hasImage) {
            const proceed = confirm('No product images have been uploaded. The product will be saved without visual print areas. Continue?');
            if (!proceed) return;
        }

        const saved = this.store.saveProduct(product);
        if (saved) {
            console.log('Product saved successfully:', saved);
            this.closeModal('product-modal');
            this.renderProducts();
            this.updateStats();
            alert('Product saved successfully!');
        } else {
            console.error('Failed to save product');
            alert('Failed to save product. Check the console for errors.');
        }
    }

    renderProducts() {
        const products = this.store.getProducts();
        const container = document.getElementById('products-list');

        if (products.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-box"></i>
                    <p>No products yet. Click "Add Product" to create one.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = products.map(product => {
            // Get thumbnail from first color's first view image
            let thumbnail = null;
            if (product.colors && product.colors.length > 0) {
                const firstColor = product.colors[0];
                const firstViewId = product.views?.[0]?.id;
                thumbnail = firstColor.viewImages?.[firstViewId];
            }
            // Fallback: legacy format with image in view
            if (!thumbnail && product.views?.length > 0) {
                const firstViewWithImage = product.views.find(v => v.image);
                thumbnail = firstViewWithImage?.image;
            }

            const viewCount = product.views?.length || 0;
            const colorCount = product.colors?.length || 0;
            const sizeCount = product.sizes?.length || 0;

            // Get print size from first view
            const firstView = product.views?.[0];
            const printWidth = firstView?.printArea?.printWidthInches || '?';
            const printHeight = firstView?.printArea?.printHeightInches || '?';

            return `
                <div class="grid-item" data-product-id="${product.id}">
                    <div class="grid-item-image">
                        ${thumbnail
                            ? `<img src="${thumbnail}" alt="${product.name}">`
                            : `<i class="fas fa-box" style="font-size:48px;color:#ccc;"></i>`
                        }
                    </div>
                    <div class="grid-item-info">
                        <div class="grid-item-title">${product.name}</div>
                        <div class="grid-item-meta">
                            ${printWidth}" x ${printHeight}" • ${viewCount} view(s) • ${colorCount} color(s) • ${sizeCount} size(s)
                        </div>
                        <div class="grid-item-meta">$${product.price?.toFixed(2) || '0.00'}</div>
                    </div>
                    <div class="grid-item-actions">
                        <button class="btn small secondary btn-edit-product"><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn small danger btn-delete-product"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event handlers
        container.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('.grid-item').dataset.productId;
                const product = this.store.getProduct(id);
                this.openProductModal(product);
            });
        });

        container.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this product?')) {
                    const id = btn.closest('.grid-item').dataset.productId;
                    this.store.deleteProduct(id);
                    this.renderProducts();
                    this.updateStats();
                }
            });
        });
    }

    // =========================================================================
    // Templates
    // =========================================================================

    renderTemplates() {
        const templates = this.store.getTemplates();
        const container = document.getElementById('templates-list');

        if (templates.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-th-large"></i>
                    <p>No templates yet. Create your first template.</p>
                </div>
            `;
            return;
        }

        // TODO: Render templates
    }

    // =========================================================================
    // Fonts
    // =========================================================================

    renderFonts() {
        const fonts = this.store.getFonts();
        const container = document.getElementById('fonts-list');

        // Default system fonts
        const systemFonts = [
            { name: 'Arial', family: 'Arial, sans-serif' },
            { name: 'Helvetica', family: 'Helvetica, sans-serif' },
            { name: 'Times New Roman', family: '"Times New Roman", serif' },
            { name: 'Georgia', family: 'Georgia, serif' },
            { name: 'Verdana', family: 'Verdana, sans-serif' },
            { name: 'Impact', family: 'Impact, sans-serif' }
        ];

        const allFonts = [...systemFonts, ...fonts];

        container.innerHTML = allFonts.map(font => `
            <div class="font-item">
                <div>
                    <div class="font-preview" style="font-family: ${font.family}">${font.name}</div>
                    <div class="font-name">${font.family}</div>
                </div>
                ${font.id ? `<button class="btn small danger" data-font-id="${font.id}"><i class="fas fa-trash"></i></button>` : '<span class="text-muted">System</span>'}
            </div>
        `).join('');
    }

    // =========================================================================
    // Orders
    // =========================================================================

    renderOrders() {
        const orders = this.store.getOrders();
        const tbody = document.getElementById('orders-tbody');
        const emptyState = document.getElementById('orders-empty');
        const table = document.getElementById('orders-table');

        if (orders.length === 0) {
            table.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        table.classList.remove('hidden');
        emptyState.classList.add('hidden');

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                <td>${order.customerName || 'Guest'}</td>
                <td>${order.productName || '-'}</td>
                <td><span class="status-badge ${order.status}">${order.status}</span></td>
                <td>
                    <button class="btn small secondary" data-order-id="${order.id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // =========================================================================
    // Pricing
    // =========================================================================

    loadPricing() {
        const pricing = this.store.getPricing();
        document.getElementById('price-additional-view').value = pricing.additionalView || 0;
        document.getElementById('price-fold-bag').value = pricing.foldAndBag || 0;
        document.getElementById('price-neck-tags').value = pricing.neckTags || 0;
    }

    // =========================================================================
    // Settings
    // =========================================================================

    setupSettings() {
        document.getElementById('save-settings-btn')?.addEventListener('click', () => {
            this.saveSettingsForm();
        });

        document.getElementById('save-pricing-btn')?.addEventListener('click', () => {
            this.savePricingForm();
        });

        document.getElementById('export-data-btn')?.addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('import-data-btn')?.addEventListener('click', () => {
            document.getElementById('import-data-input').click();
        });

        document.getElementById('import-data-input')?.addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        document.getElementById('clear-data-btn')?.addEventListener('click', () => {
            if (confirm('This will delete ALL data. Are you sure?')) {
                this.store.clearAllData();
                this.updateStats();
                alert('All data cleared.');
            }
        });
    }

    loadSettings() {
        const settings = this.store.getSettings();
        document.getElementById('setting-default-dpi').value = settings.defaultDPI || 300;
        document.getElementById('setting-default-unit').value = settings.defaultUnit || 'inches';
    }

    saveSettingsForm() {
        const settings = {
            defaultDPI: parseInt(document.getElementById('setting-default-dpi').value),
            defaultUnit: document.getElementById('setting-default-unit').value
        };
        this.store.saveSettings(settings);
        alert('Settings saved!');
    }

    savePricingForm() {
        const pricing = {
            additionalView: parseFloat(document.getElementById('price-additional-view').value) || 0,
            foldAndBag: parseFloat(document.getElementById('price-fold-bag').value) || 0,
            neckTags: parseFloat(document.getElementById('price-neck-tags').value) || 0
        };
        this.store.savePricing(pricing);
        alert('Pricing rules saved!');
    }

    exportData() {
        const data = this.store.exportAllData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `product-designer-data-${Date.now()}.json`;
        link.href = url;
        link.click();

        URL.revokeObjectURL(url);
    }

    importData(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (this.store.importData(e.target.result)) {
                alert('Data imported successfully!');
                this.updateStats();
                this.loadSectionData(this.currentSection);
            } else {
                alert('Failed to import data. Please check the file format.');
            }
        };
        reader.readAsText(file);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.adminApp = new AdminApp();
});
