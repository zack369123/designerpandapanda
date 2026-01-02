/**
 * Units - Conversion utility for pixels/inches/cm
 * Default DPI: 72 (screen) or 300 (print quality)
 */

export class Units {
    constructor(dpi = 72) {
        this.dpi = dpi;
    }

    /**
     * Set DPI
     */
    setDPI(dpi) {
        this.dpi = dpi;
    }

    /**
     * Get current DPI
     */
    getDPI() {
        return this.dpi;
    }

    /**
     * Pixels to inches
     */
    pxToInches(px) {
        return px / this.dpi;
    }

    /**
     * Inches to pixels
     */
    inchesToPx(inches) {
        return inches * this.dpi;
    }

    /**
     * Pixels to centimeters
     */
    pxToCm(px) {
        return (px / this.dpi) * 2.54;
    }

    /**
     * Centimeters to pixels
     */
    cmToPx(cm) {
        return (cm / 2.54) * this.dpi;
    }

    /**
     * Inches to centimeters
     */
    inchesToCm(inches) {
        return inches * 2.54;
    }

    /**
     * Centimeters to inches
     */
    cmToInches(cm) {
        return cm / 2.54;
    }

    /**
     * Format pixels as inches string
     * @param {number} px - Pixels
     * @param {number} decimals - Decimal places (default 2)
     * @returns {string} Formatted string like "2.5 in"
     */
    formatAsInches(px, decimals = 2) {
        const inches = this.pxToInches(px);
        return `${inches.toFixed(decimals)}`;
    }

    /**
     * Format pixels as inches with unit
     * @param {number} px - Pixels
     * @param {number} decimals - Decimal places (default 2)
     * @returns {string} Formatted string like "2.5 in"
     */
    formatAsInchesWithUnit(px, decimals = 2) {
        return `${this.formatAsInches(px, decimals)} in`;
    }

    /**
     * Format dimensions as inches
     * @param {number} widthPx - Width in pixels
     * @param {number} heightPx - Height in pixels
     * @param {number} decimals - Decimal places
     * @returns {string} Formatted string like "2.5 × 3.0 in"
     */
    formatDimensionsAsInches(widthPx, heightPx, decimals = 2) {
        const w = this.pxToInches(widthPx).toFixed(decimals);
        const h = this.pxToInches(heightPx).toFixed(decimals);
        return `${w} × ${h} in`;
    }

    /**
     * Parse inches string to pixels
     * @param {string} str - String like "2.5" or "2.5 in"
     * @returns {number} Pixels
     */
    parseInchesToPx(str) {
        const value = parseFloat(str.replace(/[^\d.-]/g, ''));
        return isNaN(value) ? 0 : this.inchesToPx(value);
    }
}

// Create singleton instance with default 72 DPI
export const units = new Units(72);
