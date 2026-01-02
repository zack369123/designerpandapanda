/**
 * StageManager - Multi-view/stage support (Lumise-style)
 * Handles multiple design views (front, back, sleeves, etc.)
 *
 * Now integrates with ProductLoader to use admin-configured product views
 */

export class StageManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.events = window.designerEvents;

        this.stages = new Map();
        this.currentStage = null;
        this.productData = null;  // Holds loaded product data

        this.init();
    }

    /**
     * Initialize stage manager
     */
    init() {
        this.tabsContainer = document.getElementById('stage-tabs');

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for product loaded events
        this.events.on('product:loaded', (productData) => {
            this.loadProductViews(productData);
        });
    }

    /**
     * Load product views from ProductLoader data
     * @param {Object} productData - Processed product data from ProductLoader
     */
    loadProductViews(productData) {
        if (!productData || !productData.views || productData.views.length === 0) {
            console.warn('No views in product data, using defaults');
            this.initializeDefaultStages();
            return;
        }

        this.productData = productData;

        // Clear existing stages
        this.stages.clear();
        this.tabsContainer.innerHTML = '';

        // Create stage for each product view
        productData.views.forEach((view, index) => {
            this.addStage(view.id, view.name, {
                image: view.image,
                printArea: view.printArea
            });
        });

        // Switch to first view
        const firstViewId = productData.views[0].id;
        this.switchStage(firstViewId);

        this.events.emit('stages:loaded', { count: productData.views.length });
    }

    /**
     * Initialize with default stages (when no product loaded)
     */
    initializeDefaultStages() {
        this.stages.clear();
        this.tabsContainer.innerHTML = '';

        // Add default front/back stages
        this.addStage('front', 'Front', {
            image: null,
            printArea: {
                widthPercent: 40,
                heightPercent: 50,
                leftPercent: 0,
                topPercent: 0,
                widthInches: 8,
                heightInches: 10
            }
        });

        this.addStage('back', 'Back', {
            image: null,
            printArea: {
                widthPercent: 40,
                heightPercent: 50,
                leftPercent: 0,
                topPercent: 0,
                widthInches: 8,
                heightInches: 10
            }
        });

        this.switchStage('front');
    }

    /**
     * Add a new stage
     */
    addStage(id, label, viewData = {}) {
        this.stages.set(id, {
            id,
            label,
            viewData: viewData,  // Product view data (image, printArea)
            designState: null,   // Canvas design state (user's work)
            thumbnail: null
        });

        // Create tab UI
        this.createTabUI(id, label);
    }

    /**
     * Create tab UI element
     */
    createTabUI(id, label) {
        const tab = document.createElement('button');
        tab.className = 'stage-tab';
        tab.dataset.stage = id;
        tab.textContent = label;

        // Mark first tab as active
        if (this.stages.size === 1 || this.currentStage === id) {
            tab.classList.add('active');
        }

        tab.addEventListener('click', () => {
            this.switchStage(id);
        });

        this.tabsContainer.appendChild(tab);
    }

    /**
     * Switch to a different stage
     */
    switchStage(stageId) {
        if (!this.stages.has(stageId)) {
            console.error('Stage not found:', stageId);
            return;
        }

        // Save current stage design (if we have one)
        if (this.currentStage) {
            this.saveCurrentStageDesign();
        }

        // Update UI
        this.tabsContainer.querySelectorAll('.stage-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.stage === stageId);
        });

        // Switch to new stage
        this.currentStage = stageId;
        const stage = this.stages.get(stageId);

        // Load product view (image + print area)
        if (stage.viewData) {
            this.canvasManager.loadProductView({
                id: stageId,
                name: stage.label,
                image: stage.viewData.image,
                printArea: stage.viewData.printArea
            });
        }

        // Restore user's design for this stage (after a short delay to let product load)
        setTimeout(() => {
            if (stage.designState) {
                this.loadStageDesign(stageId);
            }
            this.events.emit('layers:update');
        }, 100);

        this.events.emit('stage:switched', stageId);
    }

    /**
     * Save current stage's design (user's objects only)
     */
    saveCurrentStageDesign() {
        const stage = this.stages.get(this.currentStage);
        if (!stage) return;

        // Get only design objects (not product image, print area markers)
        const designObjects = this.canvasManager.getDesignObjects();

        // Serialize design objects
        stage.designState = designObjects.map(obj => obj.toJSON([
            'id', 'name', 'selectable', 'evented', 'lockMovementX', 'lockMovementY',
            'lockRotation', 'lockScalingX', 'lockScalingY', 'hasControls',
            '_originalSrc', '_originalWidth', '_originalHeight', 'isClipart'
        ]));

        // Generate thumbnail
        stage.thumbnail = this.canvasManager.toDataURL({ format: 'png', multiplier: 0.2 });
    }

    /**
     * Load stage's design objects
     */
    loadStageDesign(stageId) {
        const stage = this.stages.get(stageId);
        if (!stage || !stage.designState) return;

        const fabricCanvas = this.canvasManager.fabricCanvas;

        // Load each design object
        stage.designState.forEach(objData => {
            fabric.util.enlivenObjects([objData], (objects) => {
                objects.forEach(obj => {
                    // Apply clipping path
                    this.canvasManager.applyClipPathToObject(obj);
                    fabricCanvas.add(obj);
                });
                fabricCanvas.renderAll();
            });
        });
    }

    /**
     * Get current stage ID
     */
    getCurrentStage() {
        return this.currentStage;
    }

    /**
     * Get current stage data
     */
    getCurrentStageData() {
        return this.stages.get(this.currentStage);
    }

    /**
     * Get all stages data (for saving/exporting)
     */
    getStagesData() {
        // Make sure current stage is saved
        this.saveCurrentStageDesign();

        const data = {};
        this.stages.forEach((stage, id) => {
            data[id] = {
                label: stage.label,
                viewData: stage.viewData,
                designState: stage.designState,
                thumbnail: stage.thumbnail
            };
        });
        return data;
    }

    /**
     * Load stages data (from saved design)
     */
    loadStagesData(data, productData = null) {
        // If we have product data, load views first
        if (productData) {
            this.loadProductViews(productData);
        }

        // Then restore design states
        Object.entries(data).forEach(([id, stageData]) => {
            if (this.stages.has(id)) {
                const stage = this.stages.get(id);
                stage.designState = stageData.designState;
                stage.thumbnail = stageData.thumbnail;
            }
        });

        // Load current stage
        this.loadStageDesign(this.currentStage);
    }

    /**
     * Check if any stage has design content
     */
    hasDesignContent() {
        // Save current first
        this.saveCurrentStageDesign();

        for (const [id, stage] of this.stages) {
            if (stage.designState && stage.designState.length > 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get count of stages with designs
     */
    getDesignedStagesCount() {
        this.saveCurrentStageDesign();

        let count = 0;
        this.stages.forEach(stage => {
            if (stage.designState && stage.designState.length > 0) {
                count++;
            }
        });
        return count;
    }

    /**
     * Rename stage
     */
    renameStage(id, newLabel) {
        const stage = this.stages.get(id);
        if (stage) {
            stage.label = newLabel;

            // Update tab UI
            const tab = this.tabsContainer.querySelector(`[data-stage="${id}"]`);
            if (tab) {
                tab.textContent = newLabel;
            }

            this.events.emit('stage:renamed', { id, label: newLabel });
        }
    }

    /**
     * Get stage thumbnail
     */
    getStageThumbnail(id) {
        const stage = this.stages.get(id);
        return stage ? stage.thumbnail : null;
    }

    /**
     * Get all stage thumbnails
     */
    getAllThumbnails() {
        // Save current first
        this.saveCurrentStageDesign();

        const thumbnails = {};
        this.stages.forEach((stage, id) => {
            thumbnails[id] = stage.thumbnail;
        });
        return thumbnails;
    }

    /**
     * Clear all designs but keep stages
     */
    clearAllDesigns() {
        this.stages.forEach(stage => {
            stage.designState = null;
            stage.thumbnail = null;
        });

        // Clear current canvas and reload product view
        const currentStageData = this.stages.get(this.currentStage);
        if (currentStageData && currentStageData.viewData) {
            this.canvasManager.loadProductView({
                id: this.currentStage,
                name: currentStageData.label,
                image: currentStageData.viewData.image,
                printArea: currentStageData.viewData.printArea
            });
        }

        this.events.emit('designs:cleared');
    }
}
