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
        this.currentColorIndex = 0;
        this.colorSizeQuantities = {}; // { colorId: { sizeId: quantity } }
        this.selectedVAS = {
            foldAndBag: false,
            neckTags: false,
            neckTagImages: {} // { colorId_sizeId: imageDataUrl }
        };
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
        this.currentColorIndex = 0;
        this.colorSizeQuantities = {}; // Reset quantities for new product
        this.selectedVAS = {
            foldAndBag: false,
            neckTags: false,
            neckTagImages: {}
        };

        return this.getProcessedProduct();
    }

    /**
     * Get the current product with calculated dimensions
     */
    getProcessedProduct() {
        if (!this.currentProduct) return null;

        const product = this.currentProduct;
        const currentColor = this.getCurrentColor();

        const views = (product.views || []).map((view, index) => {
            return this.processView(view, index, currentColor);
        });

        // Process colors for UI display
        const colors = (product.colors || []).map((color, index) => ({
            id: color.id,
            name: color.name,
            colorCode: color.colorCode,
            isActive: index === this.currentColorIndex
        }));

        // Process sizes for UI display (quantities for current color)
        const currentColorId = currentColor?.id;
        const currentColorQtys = currentColorId ? (this.colorSizeQuantities[currentColorId] || {}) : {};
        const sizes = (product.sizes || []).map((size) => ({
            id: size.id,
            name: size.name,
            upcharge: size.upcharge || 0,
            quantity: currentColorQtys[size.id] || 0
        }));

        // Get VAS configuration
        const vas = product.vas || {
            foldAndBag: { enabled: false, price: 0, description: '' },
            neckTags: { enabled: false, price: 0, description: '' }
        };

        return {
            id: product.id,
            name: product.name,
            price: product.price || 0,
            dpi: product.dpi || 300,
            views: views,
            colors: colors,
            sizes: sizes,
            vas: vas,
            currentViewIndex: this.currentViewIndex,
            currentColorIndex: this.currentColorIndex,
            colorSizeQuantities: JSON.parse(JSON.stringify(this.colorSizeQuantities)),
            selectedVAS: { ...this.selectedVAS }
        };
    }

    /**
     * Process a single view with calculated print area dimensions
     */
    processView(view, index, currentColor = null) {
        const printArea = view.printArea || {};

        // Get image from current color's viewImages, fallback to legacy view.image
        let image = null;
        if (currentColor && currentColor.viewImages && currentColor.viewImages[view.id]) {
            image = currentColor.viewImages[view.id];
        } else if (view.image) {
            // Legacy support: image stored directly on view
            image = view.image;
        }

        return {
            id: view.id,
            name: view.name || `View ${index + 1}`,
            image: image,
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
        const currentColor = this.getCurrentColor();
        return this.processView(
            this.currentProduct.views[this.currentViewIndex],
            this.currentViewIndex,
            currentColor
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
     * Get current color
     */
    getCurrentColor() {
        if (!this.currentProduct || !this.currentProduct.colors) return null;
        return this.currentProduct.colors[this.currentColorIndex] || null;
    }

    /**
     * Get all colors for current product
     */
    getColors() {
        if (!this.currentProduct || !this.currentProduct.colors) return [];
        return this.currentProduct.colors.map((color, index) => ({
            id: color.id,
            name: color.name,
            colorCode: color.colorCode,
            isActive: index === this.currentColorIndex
        }));
    }

    /**
     * Switch to a different color
     * Returns the current view with new color's image
     */
    switchColor(index) {
        if (!this.currentProduct || !this.currentProduct.colors) return null;
        if (index < 0 || index >= this.currentProduct.colors.length) return null;

        this.currentColorIndex = index;
        return this.getCurrentView();
    }

    /**
     * Switch color by color ID
     */
    switchColorById(colorId) {
        if (!this.currentProduct || !this.currentProduct.colors) return null;
        const index = this.currentProduct.colors.findIndex(c => c.id === colorId);
        if (index === -1) return null;
        return this.switchColor(index);
    }

    // =========================================================================
    // Size Quantities Management (Per-Color Bulk Order)
    // =========================================================================

    /**
     * Get all sizes for current product (with quantities for current color)
     */
    getSizes() {
        if (!this.currentProduct || !this.currentProduct.sizes) return [];
        const currentColor = this.getCurrentColor();
        const colorId = currentColor?.id;
        const colorQtys = colorId ? (this.colorSizeQuantities[colorId] || {}) : {};

        return this.currentProduct.sizes.map((size) => ({
            id: size.id,
            name: size.name,
            upcharge: size.upcharge || 0,
            quantity: colorQtys[size.id] || 0
        }));
    }

    /**
     * Get size quantities for current color
     */
    getSizeQuantities() {
        const currentColor = this.getCurrentColor();
        const colorId = currentColor?.id;
        return colorId ? { ...(this.colorSizeQuantities[colorId] || {}) } : {};
    }

    /**
     * Get all color/size quantities (full order)
     */
    getAllColorSizeQuantities() {
        return JSON.parse(JSON.stringify(this.colorSizeQuantities));
    }

    /**
     * Set quantity for a specific size (for current color)
     */
    setSizeQuantity(sizeId, quantity) {
        const currentColor = this.getCurrentColor();
        const colorId = currentColor?.id;
        if (!colorId) return;

        if (!this.colorSizeQuantities[colorId]) {
            this.colorSizeQuantities[colorId] = {};
        }

        if (quantity <= 0) {
            delete this.colorSizeQuantities[colorId][sizeId];
            // Clean up empty color entries
            if (Object.keys(this.colorSizeQuantities[colorId]).length === 0) {
                delete this.colorSizeQuantities[colorId];
            }
        } else {
            this.colorSizeQuantities[colorId][sizeId] = quantity;
        }
    }

    /**
     * Get total quantity for current color
     */
    getTotalQuantityForCurrentColor() {
        const currentColor = this.getCurrentColor();
        const colorId = currentColor?.id;
        if (!colorId || !this.colorSizeQuantities[colorId]) return 0;
        return Object.values(this.colorSizeQuantities[colorId]).reduce((sum, qty) => sum + qty, 0);
    }

    /**
     * Get total quantity across ALL colors
     */
    getTotalQuantity() {
        let total = 0;
        for (const colorId in this.colorSizeQuantities) {
            for (const sizeId in this.colorSizeQuantities[colorId]) {
                total += this.colorSizeQuantities[colorId][sizeId];
            }
        }
        return total;
    }

    /**
     * Get sizes that have quantity > 0 (for current color)
     */
    getSelectedSizes() {
        if (!this.currentProduct || !this.currentProduct.sizes) return [];
        const currentColor = this.getCurrentColor();
        const colorId = currentColor?.id;
        const colorQtys = colorId ? (this.colorSizeQuantities[colorId] || {}) : {};

        return this.currentProduct.sizes
            .filter(size => (colorQtys[size.id] || 0) > 0)
            .map(size => ({
                id: size.id,
                name: size.name,
                upcharge: size.upcharge || 0,
                quantity: colorQtys[size.id]
            }));
    }

    /**
     * Get full order details (all colors with their sizes and quantities)
     */
    getFullOrderDetails() {
        if (!this.currentProduct) return [];

        const colors = this.currentProduct.colors || [];
        const sizes = this.currentProduct.sizes || [];
        const orderLines = [];

        for (const colorId in this.colorSizeQuantities) {
            const color = colors.find(c => c.id === colorId);
            if (!color) continue;

            for (const sizeId in this.colorSizeQuantities[colorId]) {
                const qty = this.colorSizeQuantities[colorId][sizeId];
                if (qty <= 0) continue;

                const size = sizes.find(s => s.id === sizeId);
                if (!size) continue;

                orderLines.push({
                    colorId: color.id,
                    colorName: color.name,
                    colorCode: color.colorCode,
                    sizeId: size.id,
                    sizeName: size.name,
                    upcharge: size.upcharge || 0,
                    quantity: qty
                });
            }
        }

        return orderLines;
    }

    // =========================================================================
    // Value Added Services Management
    // =========================================================================

    /**
     * Get VAS configuration for current product
     */
    getVAS() {
        if (!this.currentProduct) return null;
        return this.currentProduct.vas || {
            foldAndBag: { enabled: false, price: 0, description: '' },
            neckTags: { enabled: false, price: 0, description: '' }
        };
    }

    /**
     * Toggle Fold & Bag service
     */
    toggleFoldAndBag(enabled) {
        this.selectedVAS.foldAndBag = enabled;
    }

    /**
     * Toggle Neck Tags service
     */
    toggleNeckTags(enabled) {
        this.selectedVAS.neckTags = enabled;
    }

    /**
     * Set neck tag image for a size
     */
    setNeckTagImage(sizeId, imageDataUrl) {
        this.selectedVAS.neckTagImages[sizeId] = imageDataUrl;
    }

    /**
     * Get selected VAS options
     */
    getSelectedVAS() {
        return { ...this.selectedVAS };
    }

    /**
     * Check if neck tags can be enabled (requires any size with quantity > 0 across all colors)
     */
    canEnableNeckTags() {
        return this.getTotalQuantity() > 0;
    }

    /**
     * Get all unique sizes that have quantities across all colors (for neck tags)
     */
    getAllSelectedSizes() {
        if (!this.currentProduct || !this.currentProduct.sizes) return [];

        const sizesWithQty = new Set();

        for (const colorId in this.colorSizeQuantities) {
            for (const sizeId in this.colorSizeQuantities[colorId]) {
                if (this.colorSizeQuantities[colorId][sizeId] > 0) {
                    sizesWithQty.add(sizeId);
                }
            }
        }

        return this.currentProduct.sizes
            .filter(size => sizesWithQty.has(size.id))
            .map(size => ({
                id: size.id,
                name: size.name,
                upcharge: size.upcharge || 0
            }));
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
     * Get global pricing rules
     */
    getPricing() {
        const data = localStorage.getItem(this.prefix + 'pricing');
        try {
            return data ? JSON.parse(data) : {
                additionalView: 0,  // Price for 2nd, 3rd, etc. print locations
                foldAndBag: 0,      // Per item
                neckTags: 0         // Per item
            };
        } catch (e) {
            return { additionalView: 0, foldAndBag: 0, neckTags: 0 };
        }
    }

    /**
     * Calculate price for current design
     * Note: This is a simplified calculation. The full calculation is done in Designer.renderOrderSummary()
     */
    calculatePrice(designedViewIds = []) {
        if (!this.currentProduct) return 0;

        const pricing = this.getPricing();
        const basePrice = this.currentProduct.price || 0;

        // Calculate base price with quantities and size upcharges
        let total = 0;
        const orderLines = this.getFullOrderDetails();
        orderLines.forEach(line => {
            total += line.quantity * (basePrice + (line.upcharge || 0));
        });

        // Add view pricing
        const views = this.currentProduct.views || [];
        let isFirstView = true;

        designedViewIds.forEach(viewId => {
            const view = views.find(v => v.id === viewId);
            if (!view) return;

            // Views marked "always charge extra"
            if (view.alwaysChargeExtra) {
                total += view.extraPrice || 0;
            } else {
                // First regular view is free, additional views cost additionalViewPrice
                if (isFirstView) {
                    isFirstView = false;
                } else {
                    total += pricing.additionalView || 0;
                }
            }
        });

        // Add VAS pricing
        const totalQty = this.getTotalQuantity();
        const vas = this.currentProduct.vas || {};

        if (this.selectedVAS.foldAndBag && vas?.foldAndBag?.enabled) {
            total += totalQty * (pricing.foldAndBag || 0);
        }

        if (this.selectedVAS.neckTags && vas?.neckTags?.enabled) {
            total += totalQty * (pricing.neckTags || 0);
        }

        return total;
    }
}

// Export singleton
export const productLoader = new ProductLoader();
