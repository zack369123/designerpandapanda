/**
 * ProductLoader - Loads product configurations from admin data store
 *
 * This connects the frontend designer to products configured in the admin panel.
 * Currently uses localStorage (same as admin), but can be swapped to API calls later.
 */

export class ProductLoader {
    constructor() {
        this.prefix = 'cpd_'; // Must match admin DataStore prefix
        this.currentProduct = null;
        this.currentViewIndex = 0;
    }

    /**
     * Get all available products
     */
    getProducts() {
        const data = localStorage.getItem(this.prefix + 'products');
        try {
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error loading products:', e);
            return [];
        }
    }

    /**
     * Get a single product by ID
     */
    getProduct(id) {
        const products = this.getProducts();
        return products.find(p => p.id === id);
    }

    /**
     * Load a product for the designer
     * Returns processed product data ready for the canvas
     */
    loadProduct(productId) {
        const product = this.getProduct(productId);
        if (!product) {
            console.error('Product not found:', productId);
            return null;
        }

        this.currentProduct = product;
        this.currentViewIndex = 0;

        return this.getProcessedProduct();
    }

    /**
     * Get the current product with calculated dimensions
     */
    getProcessedProduct() {
        if (!this.currentProduct) return null;

        const product = this.currentProduct;
        const views = (product.views || []).map((view, index) => {
            return this.processView(view, index);
        });

        return {
            id: product.id,
            name: product.name,
            price: product.price || 0,
            dpi: product.dpi || 300,
            views: views,
            currentViewIndex: this.currentViewIndex
        };
    }

    /**
     * Process a single view with calculated print area dimensions
     */
    processView(view, index) {
        const printArea = view.printArea || {};

        return {
            id: view.id,
            name: view.name || `View ${index + 1}`,
            image: view.image || null,
            printArea: {
                // Percentages for positioning on product image
                widthPercent: printArea.widthPercent || 40,
                heightPercent: printArea.heightPercent || 50,
                leftPercent: printArea.leftPercent || 0,
                topPercent: printArea.topPercent || 0,
                // Actual print dimensions in inches
                widthInches: printArea.printWidthInches || 8,
                heightInches: printArea.printHeightInches || 10
            }
        };
    }

    /**
     * Get current view
     */
    getCurrentView() {
        if (!this.currentProduct || !this.currentProduct.views) return null;
        return this.processView(
            this.currentProduct.views[this.currentViewIndex],
            this.currentViewIndex
        );
    }

    /**
     * Switch to a different view
     */
    switchView(index) {
        if (!this.currentProduct || !this.currentProduct.views) return null;
        if (index < 0 || index >= this.currentProduct.views.length) return null;

        this.currentViewIndex = index;
        return this.getCurrentView();
    }

    /**
     * Get settings (DPI, units, etc.)
     */
    getSettings() {
        const data = localStorage.getItem(this.prefix + 'settings');
        try {
            return data ? JSON.parse(data) : {
                defaultDPI: 300,
                defaultUnit: 'inches',
                screenDPI: 72
            };
        } catch (e) {
            return { defaultDPI: 300, defaultUnit: 'inches', screenDPI: 72 };
        }
    }

    /**
     * Get cliparts from admin
     */
    getCliparts(category = null) {
        const data = localStorage.getItem(this.prefix + 'cliparts');
        try {
            const cliparts = data ? JSON.parse(data) : [];
            if (category) {
                return cliparts.filter(c => c.category === category);
            }
            return cliparts;
        } catch (e) {
            return [];
        }
    }

    /**
     * Get pricing rules
     */
    getPricing() {
        const data = localStorage.getItem(this.prefix + 'pricing');
        try {
            return data ? JSON.parse(data) : {
                perText: 0,
                perImage: 0,
                perClipart: 0,
                perView: 0,
                fullCoverage: 0
            };
        } catch (e) {
            return { perText: 0, perImage: 0, perClipart: 0, perView: 0, fullCoverage: 0 };
        }
    }

    /**
     * Calculate price for current design
     */
    calculatePrice(objects = []) {
        if (!this.currentProduct) return 0;

        const pricing = this.getPricing();
        let total = this.currentProduct.price || 0;

        objects.forEach(obj => {
            if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                total += pricing.perText || 0;
            } else if (obj.type === 'image') {
                if (obj.isClipart) {
                    total += pricing.perClipart || 0;
                } else {
                    total += pricing.perImage || 0;
                }
            }
        });

        // Add per-view pricing if using multiple views
        const viewsUsed = this.currentProduct.views?.filter(v => v.hasDesign).length || 1;
        if (viewsUsed > 1) {
            total += (viewsUsed - 1) * (pricing.perView || 0);
        }

        return total;
    }
}

// Export singleton
export const productLoader = new ProductLoader();
