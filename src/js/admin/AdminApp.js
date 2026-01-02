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

        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupModals();
        this.setupModalTabs();
        this.setupProducts();
        this.setupCliparts();
        this.setupSettings();
        this.setupDashboard();
        this.setupPrintAreaEditor();

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
            cliparts: 'Clipart Library',
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
            case 'cliparts':
                this.renderCliparts();
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
            case 'upload-cliparts':
                this.showSection('cliparts');
                this.openClipartUploadModal();
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
            image: null,
            printArea: {
                widthPercent: 40,
                heightPercent: 50,
                leftPercent: 0,
                topPercent: 0,
                printWidthInches: 8,
                printHeightInches: 10
            }
        }];
        this.currentViewIndex = 0;
    }

    /**
     * Add a new product view
     */
    addProductView() {
        const viewNumber = this.productViews.length + 1;
        const newView = {
            id: this.generateViewId(),
            name: viewNumber === 2 ? 'Back' : `View ${viewNumber}`,
            image: null,
            printArea: {
                widthPercent: 40,
                heightPercent: 50,
                leftPercent: 0,
                topPercent: 0,
                printWidthInches: 8,
                printHeightInches: 10
            }
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

        // Load image into editor if exists
        if (view.image) {
            this.printAreaEditor.loadProductImage(view.image).then(() => {
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
    }

    /**
     * Render the views list in the sidebar
     */
    renderViewsList() {
        const container = document.getElementById('views-list');
        if (!container) return;

        container.innerHTML = this.productViews.map((view, index) => `
            <div class="view-item ${index === this.currentViewIndex ? 'active' : ''}" data-index="${index}">
                <div class="view-thumb">
                    ${view.image
                        ? `<img src="${view.image}" alt="${view.name}">`
                        : `<i class="fas fa-image"></i>`
                    }
                </div>
                <div class="view-info">
                    <input type="text" class="view-name-input" value="${view.name}" data-index="${index}">
                    <div class="view-status ${view.image ? 'has-image' : ''}">
                        ${view.image ? 'Image set' : 'No image'}
                    </div>
                </div>
                <button type="button" class="btn-icon btn-remove-view" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

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
     */
    handleViewImageUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Compress image to reduce storage size
                const compressedData = this.compressImage(img, 800, 0.7);
                this.productViews[this.currentViewIndex].image = compressedData;

                // Load into editor
                this.printAreaEditor.loadProductImage(compressedData).then(() => {
                    this.renderViewsList();
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
    }

    /**
     * Generate unique view ID
     */
    generateViewId() {
        return 'view_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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
        document.getElementById('stat-cliparts').textContent = stats.cliparts;
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

        // Initialize or load views
        if (product) {
            title.textContent = 'Edit Product';
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-sku').value = product.sku || '';
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-price').value = product.price || 0;
            document.getElementById('product-category').value = product.category || 'other';
            document.getElementById('product-dpi').value = product.dpi || 300;

            // Load views with print areas
            if (product.views && product.views.length > 0) {
                this.productViews = product.views.map(v => ({
                    id: v.id || this.generateViewId(),
                    name: v.name || 'Untitled',
                    image: v.image || null,
                    printArea: v.printArea || {
                        widthPercent: 40,
                        heightPercent: 50,
                        leftPercent: 0,
                        topPercent: 0,
                        printWidthInches: 8,
                        printHeightInches: 10
                    }
                }));
            } else {
                this.initializeViews();
            }
        } else {
            title.textContent = 'Add Product';
            this.initializeViews();
        }

        this.currentViewIndex = 0;
        this.renderViewsList();

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
                image: v.image,
                printArea: v.printArea
            }))
        };

        if (!product.name) {
            alert('Product name is required');
            return;
        }

        // Validate at least one view has an image
        const hasImage = product.views.some(v => v.image);
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
            // Get thumbnail from first view with an image
            const firstViewWithImage = product.views?.find(v => v.image);
            const thumbnail = firstViewWithImage?.image;
            const viewCount = product.views?.length || 0;

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
                            ${printWidth}" x ${printHeight}" print • ${viewCount} view(s)
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
    // Cliparts
    // =========================================================================

    setupCliparts() {
        document.getElementById('upload-cliparts-btn')?.addEventListener('click', () => {
            this.openClipartUploadModal();
        });

        // Dropzone
        const dropzone = document.getElementById('clipart-dropzone');
        const fileInput = document.getElementById('clipart-file-input');

        dropzone?.querySelector('.btn')?.addEventListener('click', () => fileInput?.click());

        fileInput?.addEventListener('change', (e) => {
            this.handleClipartFiles(e.target.files);
        });

        dropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        dropzone?.addEventListener('dragleave', () => {
            dropzone.classList.remove('drag-over');
        });

        dropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            this.handleClipartFiles(e.dataTransfer.files);
        });

        // Confirm upload
        document.getElementById('confirm-clipart-upload')?.addEventListener('click', () => {
            this.saveUploadedCliparts();
        });

        // Category filter
        document.getElementById('clipart-category-filter')?.addEventListener('change', () => {
            this.renderCliparts();
        });
    }

    pendingCliparts = [];

    openClipartUploadModal() {
        this.pendingCliparts = [];
        document.getElementById('clipart-upload-preview').innerHTML = '';
        this.openModal('clipart-upload-modal');
    }

    handleClipartFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                this.pendingCliparts.push({
                    name: file.name,
                    dataUrl: e.target.result
                });
                this.renderClipartPreview();
            };
            reader.readAsDataURL(file);
        });
    }

    renderClipartPreview() {
        const container = document.getElementById('clipart-upload-preview');
        container.innerHTML = this.pendingCliparts.map((clip, idx) => `
            <div class="upload-preview-item" data-index="${idx}">
                <img src="${clip.dataUrl}" alt="${clip.name}">
            </div>
        `).join('');
    }

    saveUploadedCliparts() {
        const category = document.getElementById('upload-clipart-category').value;

        this.pendingCliparts.forEach(clip => {
            this.store.saveClipart({
                name: clip.name,
                dataUrl: clip.dataUrl,
                category: category
            });
        });

        this.pendingCliparts = [];
        this.closeModal('clipart-upload-modal');
        this.renderCliparts();
        this.updateStats();
    }

    renderCliparts() {
        const category = document.getElementById('clipart-category-filter')?.value || '';
        const cliparts = this.store.getClipartsByCategory(category);
        const container = document.getElementById('cliparts-list');

        if (cliparts.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-icons"></i>
                    <p>No cliparts yet. Upload some to get started.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = cliparts.map(clip => `
            <div class="grid-item" data-clipart-id="${clip.id}">
                <div class="grid-item-image">
                    <img src="${clip.dataUrl}" alt="${clip.name}">
                </div>
                <div class="grid-item-info">
                    <div class="grid-item-title">${clip.name}</div>
                    <div class="grid-item-meta">${clip.category}</div>
                </div>
            </div>
        `).join('');
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
        document.getElementById('price-per-text').value = pricing.perText || 0;
        document.getElementById('price-per-image').value = pricing.perImage || 0;
        document.getElementById('price-per-clipart').value = pricing.perClipart || 0;
        document.getElementById('price-per-view').value = pricing.perView || 0;
        document.getElementById('price-full-coverage').value = pricing.fullCoverage || 0;
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
            perText: parseFloat(document.getElementById('price-per-text').value) || 0,
            perImage: parseFloat(document.getElementById('price-per-image').value) || 0,
            perClipart: parseFloat(document.getElementById('price-per-clipart').value) || 0,
            perView: parseFloat(document.getElementById('price-per-view').value) || 0,
            fullCoverage: parseFloat(document.getElementById('price-full-coverage').value) || 0
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
