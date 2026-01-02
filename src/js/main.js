/**
 * Custom Product Designer - Main Entry Point
 * Clean modular architecture inspired by Lumise UX
 * Mobile-first responsive design
 */

import { Designer } from './core/Designer.js';
import { EventBus } from './core/EventBus.js';
import { MobileManager } from './modules/MobileManager.js';
import { units } from './utils/Units.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create global event bus for module communication
    window.designerEvents = new EventBus();

    // Set DPI for unit conversions (72 = screen, 300 = print quality)
    // At 72 DPI: 600px = 8.33 inches
    // At 96 DPI: 600px = 6.25 inches
    units.setDPI(72);

    // Make units globally accessible
    window.units = units;

    // Initialize the designer
    // Canvas size: 600x600px = 8.33x8.33 inches at 72 DPI
    const designer = new Designer({
        canvasId: 'design-canvas',
        width: 600,   // 8.33 inches at 72 DPI
        height: 600,  // 8.33 inches at 72 DPI
        backgroundColor: '#ffffff',
        dpi: 72
    });

    // Make designer accessible globally for debugging
    window.designer = designer;

    // Initialize mobile manager for responsive behavior
    const mobileManager = new MobileManager(designer);
    window.mobileManager = mobileManager;

    // Log canvas size in inches
    const widthInches = units.pxToInches(600).toFixed(2);
    const heightInches = units.pxToInches(600).toFixed(2);
    console.log(`Custom Product Designer initialized`);
    console.log(`Canvas size: ${widthInches}" x ${heightInches}" at ${units.getDPI()} DPI`);
    console.log(`Device: ${mobileManager.currentBreakpoint}`);
});
