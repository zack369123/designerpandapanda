/**
 * MobileManager - Handles mobile-specific interactions and layout
 * Inspired by Lumise's mobile implementation
 */

export class MobileManager {
    constructor(designer) {
        this.designer = designer;
        this.isMobile = false;
        this.isTablet = false;
        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;
        this.activePanel = null;
        this.touchStartY = 0;
        this.initialized = false;

        // Breakpoints (matching CSS)
        this.breakpoints = {
            mobile: 768,
            tablet: 1024,
            desktop: 1280
        };

        // DOM Elements
        this.elements = {
            app: null,
            leftSidebar: null,
            rightSidebar: null,
            bottomNav: null,
            mobileToolPanel: null,
            closeSidebar: null,
            canvasContainer: null,
            canvasWrapper: null
        };

        this.init();
    }

    init() {
        this.cacheElements();
        this.checkViewport();
        this.bindEvents();
        this.initialized = true;

        // Initial mobile setup
        if (this.isMobile) {
            this.setupMobileLayout();
        }
    }

    cacheElements() {
        this.elements.app = document.getElementById('designer-app');
        this.elements.leftSidebar = document.getElementById('left-sidebar');
        this.elements.rightSidebar = document.getElementById('right-sidebar');
        this.elements.bottomNav = document.getElementById('bottom-nav');
        this.elements.mobileToolPanel = document.getElementById('mobile-tool-panel');
        this.elements.closeSidebar = document.getElementById('close-sidebar');
        this.elements.canvasContainer = document.getElementById('canvas-container');
        this.elements.canvasWrapper = document.getElementById('canvas-wrapper');
    }

    checkViewport() {
        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;
        this.isMobile = this.windowWidth < this.breakpoints.mobile;
        this.isTablet = this.windowWidth >= this.breakpoints.mobile && this.windowWidth < this.breakpoints.tablet;
    }

    bindEvents() {
        // Window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.handleResize(), 150);
        });

        // Orientation change (mobile specific)
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleResize(), 300);
        });

        // Bottom navigation tabs
        if (this.elements.bottomNav) {
            const navItems = this.elements.bottomNav.querySelectorAll('.bottom-nav-item');
            navItems.forEach(item => {
                item.addEventListener('click', (e) => this.handleBottomNavClick(e));
                // Touch support
                item.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    this.handleBottomNavClick(e);
                });
            });

            // Mobile cart button
            const cartBtn = this.elements.bottomNav.querySelector('#mobile-cart-btn');
            if (cartBtn) {
                cartBtn.addEventListener('click', () => this.handleMobileCartClick());
            }
        }

        // Close sidebar button
        if (this.elements.closeSidebar) {
            this.elements.closeSidebar.addEventListener('click', () => this.closeSidebar());
        }

        // Close sidebar when tapping canvas on mobile
        if (this.elements.canvasContainer) {
            this.elements.canvasContainer.addEventListener('touchstart', (e) => {
                if (this.isMobile && this.elements.leftSidebar?.classList.contains('open')) {
                    // Only close if tap is directly on canvas area
                    if (e.target.closest('#canvas-container') && !e.target.closest('#canvas-wrapper')) {
                        this.closeSidebar();
                    }
                }
            }, { passive: true });
        }

        // Prevent body scroll on mobile when sidebar is open
        document.body.addEventListener('touchmove', (e) => {
            if (this.isMobile && this.elements.leftSidebar?.classList.contains('open')) {
                // Allow scroll inside sidebar
                if (!e.target.closest('.panel-body') && !e.target.closest('.sidebar-content')) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        // Handle bottom sheet swipe for right sidebar
        if (this.elements.rightSidebar) {
            this.setupBottomSheetGestures();
        }

        // Listen for canvas object selection
        if (this.designer?.canvas) {
            this.designer.canvas.on('selection:created', () => this.onObjectSelected());
            this.designer.canvas.on('selection:updated', () => this.onObjectSelected());
            this.designer.canvas.on('selection:cleared', () => this.onSelectionCleared());
        }
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.checkViewport();

        // Transition between mobile and desktop
        if (wasMobile !== this.isMobile) {
            if (this.isMobile) {
                this.setupMobileLayout();
            } else {
                this.setupDesktopLayout();
            }
        }

        // Scale canvas for viewport
        this.scaleCanvasForViewport();

        // Emit resize event
        this.emit('resize', {
            width: this.windowWidth,
            height: this.windowHeight,
            isMobile: this.isMobile,
            isTablet: this.isTablet
        });
    }

    setupMobileLayout() {
        // Close any open panels when entering mobile
        this.closeSidebar();

        // Show bottom nav
        if (this.elements.bottomNav) {
            this.elements.bottomNav.style.display = 'flex';
        }

        // Reset left sidebar state
        if (this.elements.leftSidebar) {
            this.elements.leftSidebar.classList.remove('open', 'panel-open');
        }

        // Scale canvas
        this.scaleCanvasForViewport();
    }

    setupDesktopLayout() {
        // Hide mobile elements
        this.closeSidebar();

        // Bottom nav is hidden via CSS on tablet+

        // Show left sidebar normally
        if (this.elements.leftSidebar) {
            this.elements.leftSidebar.classList.remove('open');
            this.elements.leftSidebar.classList.add('panel-open');
        }
    }

    handleBottomNavClick(e) {
        const item = e.currentTarget;
        const tab = item.dataset.tab;

        if (!tab) return;

        // If already active, close the panel
        if (item.classList.contains('active') && this.elements.leftSidebar?.classList.contains('open')) {
            this.closeSidebar();
            item.classList.remove('active');
            return;
        }

        // Remove active from all items
        const allItems = this.elements.bottomNav?.querySelectorAll('.bottom-nav-item');
        allItems?.forEach(i => i.classList.remove('active'));

        // Set this item as active
        item.classList.add('active');

        // Open sidebar with the selected tab
        this.openSidebar(tab);
    }

    openSidebar(tab) {
        if (!this.elements.leftSidebar) return;

        // Show the sidebar
        this.elements.leftSidebar.classList.add('open');

        // Activate the correct tab panel
        const panels = this.elements.leftSidebar.querySelectorAll('.tab-panel');
        panels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tab);
        });

        // Also update sidebar tab buttons if visible
        const tabBtns = this.elements.leftSidebar.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        this.activePanel = tab;
        this.emit('panelOpened', { panel: tab });
    }

    closeSidebar() {
        if (this.elements.leftSidebar) {
            this.elements.leftSidebar.classList.remove('open');
        }

        // Remove active state from bottom nav items
        const allItems = this.elements.bottomNav?.querySelectorAll('.bottom-nav-item');
        allItems?.forEach(i => i.classList.remove('active'));

        this.activePanel = null;
        this.emit('panelClosed');
    }

    handleMobileCartClick() {
        // Trigger add to cart action
        const cartBtn = document.querySelector('[data-action="add-to-cart"]');
        if (cartBtn) {
            cartBtn.click();
        }
    }

    setupBottomSheetGestures() {
        const header = this.elements.rightSidebar?.querySelector('.sidebar-header');
        if (!header) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        header.addEventListener('touchstart', (e) => {
            if (!this.isMobile) return;
            startY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });

        header.addEventListener('touchmove', (e) => {
            if (!isDragging || !this.isMobile) return;
            currentY = e.touches[0].clientY;
            const delta = currentY - startY;

            // Only allow dragging down
            if (delta > 0) {
                this.elements.rightSidebar.style.transform = `translateY(${delta}px)`;
            }
        }, { passive: true });

        header.addEventListener('touchend', () => {
            if (!isDragging || !this.isMobile) return;
            isDragging = false;

            const delta = currentY - startY;

            // If dragged more than 100px down, close the panel
            if (delta > 100) {
                this.closePropertiesPanel();
            } else {
                // Snap back
                this.elements.rightSidebar.style.transform = '';
            }
        });
    }

    openPropertiesPanel() {
        if (!this.elements.rightSidebar) return;

        this.elements.rightSidebar.classList.add('open');
        this.elements.rightSidebar.style.transform = '';
    }

    closePropertiesPanel() {
        if (!this.elements.rightSidebar) return;

        this.elements.rightSidebar.classList.remove('open');
        this.elements.rightSidebar.style.transform = '';
    }

    onObjectSelected() {
        if (this.isMobile) {
            // Show mobile tool panel
            this.showMobileToolPanel();

            // Show properties as bottom sheet
            this.openPropertiesPanel();
        }
    }

    onSelectionCleared() {
        if (this.isMobile) {
            // Hide mobile tool panel
            this.hideMobileToolPanel();

            // Hide properties panel
            this.closePropertiesPanel();
        }
    }

    showMobileToolPanel() {
        if (!this.elements.mobileToolPanel) return;

        this.elements.mobileToolPanel.classList.add('open');
        this.updateMobileToolPanel();
    }

    hideMobileToolPanel() {
        if (!this.elements.mobileToolPanel) return;

        this.elements.mobileToolPanel.classList.remove('open');
    }

    updateMobileToolPanel() {
        if (!this.elements.mobileToolPanel || !this.designer?.canvas) return;

        const activeObject = this.designer.canvas.getActiveObject();
        if (!activeObject) {
            this.hideMobileToolPanel();
            return;
        }

        let toolsHtml = '';

        // Common tools
        toolsHtml += `
            <button class="mobile-tool-btn" data-action="duplicate">
                <i class="fas fa-copy"></i>
                <span>Copy</span>
            </button>
            <button class="mobile-tool-btn" data-action="delete">
                <i class="fas fa-trash"></i>
                <span>Delete</span>
            </button>
        `;

        // Type-specific tools
        if (activeObject.type === 'i-text' || activeObject.type === 'textbox') {
            toolsHtml += `
                <button class="mobile-tool-btn" data-action="edit-text">
                    <i class="fas fa-edit"></i>
                    <span>Edit</span>
                </button>
                <button class="mobile-tool-btn" data-action="text-color">
                    <i class="fas fa-palette"></i>
                    <span>Color</span>
                </button>
            `;
        } else if (activeObject.type === 'image') {
            toolsHtml += `
                <button class="mobile-tool-btn" data-action="flip-h">
                    <i class="fas fa-arrows-alt-h"></i>
                    <span>Flip H</span>
                </button>
                <button class="mobile-tool-btn" data-action="flip-v">
                    <i class="fas fa-arrows-alt-v"></i>
                    <span>Flip V</span>
                </button>
                <button class="mobile-tool-btn" data-action="max-size">
                    <i class="fas fa-expand-arrows-alt"></i>
                    <span>Max Size</span>
                </button>
            `;
        }

        // Layer tools
        toolsHtml += `
            <button class="mobile-tool-btn" data-action="bring-front">
                <i class="fas fa-chevron-up"></i>
                <span>Front</span>
            </button>
            <button class="mobile-tool-btn" data-action="send-back">
                <i class="fas fa-chevron-down"></i>
                <span>Back</span>
            </button>
        `;

        this.elements.mobileToolPanel.innerHTML = toolsHtml;

        // Bind tool button events
        const toolBtns = this.elements.mobileToolPanel.querySelectorAll('.mobile-tool-btn');
        toolBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                this.handleMobileToolAction(action);
            });
        });
    }

    handleMobileToolAction(action) {
        // Trigger the corresponding action button if exists
        const actionBtn = document.querySelector(`[data-action="${action}"]`);
        if (actionBtn && actionBtn !== this.elements.mobileToolPanel.querySelector(`[data-action="${action}"]`)) {
            actionBtn.click();
            return;
        }

        // Otherwise emit event for custom handling
        this.emit('mobileToolAction', { action });
    }

    scaleCanvasForViewport() {
        if (!this.designer?.canvas || !this.elements.canvasWrapper) return;

        // Only apply scaling on mobile
        if (!this.isMobile) {
            this.elements.canvasWrapper.style.transform = '';
            return;
        }

        const canvas = this.designer.canvas;
        const canvasWidth = canvas.getWidth();
        const containerWidth = this.elements.canvasContainer?.clientWidth || this.windowWidth;
        const containerHeight = this.elements.canvasContainer?.clientHeight || this.windowHeight;

        // Calculate scale to fit width with padding
        const padding = 16;
        const availableWidth = containerWidth - (padding * 2);
        const availableHeight = containerHeight - (padding * 2);

        const scaleX = availableWidth / canvasWidth;
        const scaleY = availableHeight / canvas.getHeight();
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

        if (scale < 1) {
            this.elements.canvasWrapper.style.transform = `scale(${scale})`;
        } else {
            this.elements.canvasWrapper.style.transform = '';
        }
    }

    // Simple event emitter
    emit(eventName, data = {}) {
        const event = new CustomEvent(`mobile:${eventName}`, {
            detail: data,
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    // Public API
    get currentBreakpoint() {
        if (this.isMobile) return 'mobile';
        if (this.isTablet) return 'tablet';
        return 'desktop';
    }

    isPanelOpen() {
        return this.activePanel !== null;
    }
}
