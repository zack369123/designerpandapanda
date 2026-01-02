/**
 * DataStore - Mock backend using localStorage
 *
 * This simulates a backend database during development.
 * When converting to WordPress, replace these methods with WP REST API calls.
 */

export class DataStore {
    constructor() {
        this.prefix = 'cpd_'; // Custom Product Designer prefix
        this.init();
    }

    /**
     * Initialize with default data if empty
     */
    init() {
        // Initialize collections if they don't exist
        const collections = ['products', 'templates', 'cliparts', 'fonts', 'orders', 'settings', 'pricing'];

        collections.forEach(collection => {
            if (!this.get(collection)) {
                this.set(collection, []);
            }
        });

        // Initialize default settings
        if (!this.get('settings') || this.get('settings').length === 0) {
            this.set('settings', {
                defaultDPI: 300,
                defaultUnit: 'inches',
                screenDPI: 72
            });
        }

        // Initialize default pricing
        if (!this.get('pricing') || this.get('pricing').length === 0) {
            this.set('pricing', {
                perText: 0,
                perImage: 0,
                perClipart: 0,
                perView: 0,
                fullCoverage: 0
            });
        }
    }

    // =========================================================================
    // Core Storage Methods
    // =========================================================================

    /**
     * Get data from storage
     */
    get(key) {
        const data = localStorage.getItem(this.prefix + key);
        try {
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error parsing stored data:', e);
            return null;
        }
    }

    /**
     * Set data to storage
     */
    set(key, value) {
        try {
            const jsonString = JSON.stringify(value);
            const sizeKB = (jsonString.length / 1024).toFixed(2);
            console.log(`Saving ${key}: ${sizeKB} KB`);

            localStorage.setItem(this.prefix + key, jsonString);
            return true;
        } catch (e) {
            console.error('Error saving data:', e);
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                alert('Storage limit exceeded! The product images are too large. Try using smaller images or fewer views.');
            }
            return false;
        }
    }

    /**
     * Remove data from storage
     */
    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }

    // =========================================================================
    // Products CRUD
    // =========================================================================

    getProducts() {
        return this.get('products') || [];
    }

    getProduct(id) {
        const products = this.getProducts();
        return products.find(p => p.id === id);
    }

    saveProduct(product) {
        const products = this.getProducts();

        if (product.id) {
            // Update existing
            const index = products.findIndex(p => p.id === product.id);
            if (index !== -1) {
                products[index] = { ...products[index], ...product, updatedAt: Date.now() };
            }
        } else {
            // Create new
            product.id = this.generateId();
            product.createdAt = Date.now();
            product.updatedAt = Date.now();
            products.push(product);
        }

        const success = this.set('products', products);
        return success ? product : null;
    }

    deleteProduct(id) {
        const products = this.getProducts().filter(p => p.id !== id);
        this.set('products', products);
    }

    // =========================================================================
    // Templates CRUD
    // =========================================================================

    getTemplates() {
        return this.get('templates') || [];
    }

    getTemplate(id) {
        const templates = this.getTemplates();
        return templates.find(t => t.id === id);
    }

    getTemplatesByProduct(productId) {
        return this.getTemplates().filter(t => t.productId === productId);
    }

    saveTemplate(template) {
        const templates = this.getTemplates();

        if (template.id) {
            const index = templates.findIndex(t => t.id === template.id);
            if (index !== -1) {
                templates[index] = { ...templates[index], ...template, updatedAt: Date.now() };
            }
        } else {
            template.id = this.generateId();
            template.createdAt = Date.now();
            template.updatedAt = Date.now();
            templates.push(template);
        }

        this.set('templates', templates);
        return template;
    }

    deleteTemplate(id) {
        const templates = this.getTemplates().filter(t => t.id !== id);
        this.set('templates', templates);
    }

    // =========================================================================
    // Cliparts CRUD
    // =========================================================================

    getCliparts() {
        return this.get('cliparts') || [];
    }

    getClipartsByCategory(category) {
        if (!category) return this.getCliparts();
        return this.getCliparts().filter(c => c.category === category);
    }

    saveClipart(clipart) {
        const cliparts = this.getCliparts();

        if (clipart.id) {
            const index = cliparts.findIndex(c => c.id === clipart.id);
            if (index !== -1) {
                cliparts[index] = { ...cliparts[index], ...clipart };
            }
        } else {
            clipart.id = this.generateId();
            clipart.createdAt = Date.now();
            cliparts.push(clipart);
        }

        this.set('cliparts', cliparts);
        return clipart;
    }

    saveCliparts(clipartArray) {
        clipartArray.forEach(clipart => this.saveClipart(clipart));
    }

    deleteClipart(id) {
        const cliparts = this.getCliparts().filter(c => c.id !== id);
        this.set('cliparts', cliparts);
    }

    // =========================================================================
    // Fonts CRUD
    // =========================================================================

    getFonts() {
        return this.get('fonts') || [];
    }

    saveFont(font) {
        const fonts = this.getFonts();

        if (font.id) {
            const index = fonts.findIndex(f => f.id === font.id);
            if (index !== -1) {
                fonts[index] = { ...fonts[index], ...font };
            }
        } else {
            font.id = this.generateId();
            fonts.push(font);
        }

        this.set('fonts', fonts);
        return font;
    }

    deleteFont(id) {
        const fonts = this.getFonts().filter(f => f.id !== id);
        this.set('fonts', fonts);
    }

    // =========================================================================
    // Orders CRUD
    // =========================================================================

    getOrders() {
        return this.get('orders') || [];
    }

    getOrder(id) {
        return this.getOrders().find(o => o.id === id);
    }

    saveOrder(order) {
        const orders = this.getOrders();

        if (order.id) {
            const index = orders.findIndex(o => o.id === order.id);
            if (index !== -1) {
                orders[index] = { ...orders[index], ...order, updatedAt: Date.now() };
            }
        } else {
            order.id = this.generateId();
            order.orderNumber = this.generateOrderNumber();
            order.createdAt = Date.now();
            order.updatedAt = Date.now();
            order.status = order.status || 'pending';
            orders.push(order);
        }

        this.set('orders', orders);
        return order;
    }

    updateOrderStatus(id, status) {
        const order = this.getOrder(id);
        if (order) {
            order.status = status;
            this.saveOrder(order);
        }
    }

    // =========================================================================
    // Settings & Pricing
    // =========================================================================

    getSettings() {
        return this.get('settings') || {};
    }

    saveSettings(settings) {
        this.set('settings', settings);
    }

    getPricing() {
        return this.get('pricing') || {};
    }

    savePricing(pricing) {
        this.set('pricing', pricing);
    }

    // =========================================================================
    // Stats
    // =========================================================================

    getStats() {
        return {
            products: this.getProducts().length,
            templates: this.getTemplates().length,
            cliparts: this.getCliparts().length,
            orders: this.getOrders().length
        };
    }

    // =========================================================================
    // Import/Export
    // =========================================================================

    exportAllData() {
        const data = {
            products: this.getProducts(),
            templates: this.getTemplates(),
            cliparts: this.getCliparts(),
            fonts: this.getFonts(),
            orders: this.getOrders(),
            settings: this.getSettings(),
            pricing: this.getPricing(),
            exportedAt: Date.now()
        };
        return JSON.stringify(data, null, 2);
    }

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            if (data.products) this.set('products', data.products);
            if (data.templates) this.set('templates', data.templates);
            if (data.cliparts) this.set('cliparts', data.cliparts);
            if (data.fonts) this.set('fonts', data.fonts);
            if (data.orders) this.set('orders', data.orders);
            if (data.settings) this.set('settings', data.settings);
            if (data.pricing) this.set('pricing', data.pricing);

            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    }

    clearAllData() {
        const collections = ['products', 'templates', 'cliparts', 'fonts', 'orders', 'settings', 'pricing'];
        collections.forEach(c => this.remove(c));
        this.init(); // Re-initialize with defaults
    }

    /**
     * Get storage usage information
     */
    getStorageUsage() {
        const usage = {};
        let total = 0;

        Object.keys(localStorage).forEach(key => {
            const size = localStorage.getItem(key).length;
            usage[key] = (size / 1024).toFixed(2) + ' KB';
            total += size;
        });

        usage._total = (total / 1024).toFixed(2) + ' KB';
        usage._limit = '~5000 KB (5MB)';
        usage._available = ((5000 * 1024 - total) / 1024).toFixed(2) + ' KB';

        return usage;
    }

    /**
     * Clear just product data
     */
    clearProducts() {
        this.set('products', []);
        console.log('Products cleared');
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    generateId() {
        return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    generateOrderNumber() {
        const orders = this.getOrders();
        const lastNumber = orders.length > 0
            ? Math.max(...orders.map(o => parseInt(o.orderNumber?.replace('ORD-', '') || 0)))
            : 0;
        return 'ORD-' + String(lastNumber + 1).padStart(5, '0');
    }
}

// Export singleton instance
export const dataStore = new DataStore();
