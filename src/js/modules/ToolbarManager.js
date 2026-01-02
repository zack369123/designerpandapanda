/**
 * ToolbarManager - Context-aware toolbar (Lumise-style)
 * Switches tool options based on what's selected
 */

export class ToolbarManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.events = window.designerEvents;
        this.currentContext = 'default';

        this.init();
    }

    /**
     * Initialize toolbar
     */
    init() {
        this.toolbar = document.getElementById('context-toolbar');
        this.toolbarGroups = this.toolbar.querySelectorAll('.toolbar-group');

        // Listen for context changes
        this.events.on('toolbar:context', (context) => {
            this.switchContext(context);
        });

        // Listen for selection changes to update tool states
        this.events.on('selection:changed', (data) => {
            this.updateToolStates(data);
        });

        // Set up tool click handlers
        this.setupToolHandlers();

        // Set up input change handlers
        this.setupInputHandlers();
    }

    /**
     * Switch toolbar context
     */
    switchContext(context) {
        this.currentContext = context;

        // Hide all groups
        this.toolbarGroups.forEach(group => {
            group.style.display = 'none';
        });

        // Show the appropriate group
        const activeGroup = this.toolbar.querySelector(`[data-context="${context}"]`);
        if (activeGroup) {
            activeGroup.style.display = 'flex';
        }

        this.events.emit('toolbar:contextChanged', context);
    }

    /**
     * Update tool states based on selection
     */
    updateToolStates(data) {
        const obj = data.objects[0];
        if (!obj) return;

        // Update text tools
        if (data.context === 'text') {
            this.updateTextTools(obj);
        }

        // Update image tools
        if (data.context === 'image') {
            this.updateImageTools(obj);
        }

        // Update shape tools
        if (data.context === 'shape') {
            this.updateShapeTools(obj);
        }
    }

    /**
     * Update text tool values
     */
    updateTextTools(obj) {
        const fontFamily = document.getElementById('font-family');
        const fontSize = document.getElementById('font-size');
        const textColor = document.getElementById('text-color');

        if (fontFamily) fontFamily.value = obj.fontFamily || 'Arial';
        if (fontSize) fontSize.value = obj.fontSize || 24;
        if (textColor) textColor.value = obj.fill || '#000000';

        // Update style buttons
        this.updateToggleButton('bold', obj.fontWeight === 'bold');
        this.updateToggleButton('italic', obj.fontStyle === 'italic');
        this.updateToggleButton('underline', obj.underline === true);
    }

    /**
     * Update image tool values
     */
    updateImageTools(obj) {
        const opacity = document.getElementById('image-opacity');
        if (opacity) {
            opacity.value = Math.round((obj.opacity || 1) * 100);
        }
    }

    /**
     * Update shape tool values
     */
    updateShapeTools(obj) {
        const fill = document.getElementById('shape-fill');
        const stroke = document.getElementById('shape-stroke');
        const strokeWidth = document.getElementById('stroke-width');
        const opacity = document.getElementById('shape-opacity');

        if (fill) fill.value = obj.fill || '#3fc7ba';
        if (stroke) stroke.value = obj.stroke || '#000000';
        if (strokeWidth) strokeWidth.value = obj.strokeWidth || 0;
        if (opacity) opacity.value = Math.round((obj.opacity || 1) * 100);
    }

    /**
     * Update toggle button state
     */
    updateToggleButton(tool, active) {
        const btn = this.toolbar.querySelector(`[data-tool="${tool}"]`);
        if (btn) {
            btn.classList.toggle('active', active);
        }
    }

    /**
     * Set up tool button click handlers
     */
    setupToolHandlers() {
        this.toolbar.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.handleTool(tool, e.currentTarget);
            });
        });
    }

    /**
     * Handle tool actions
     */
    handleTool(tool, btn) {
        const obj = this.canvas.getSelected();

        switch (tool) {
            // Default tools
            case 'add-text':
                this.events.emit('sidebar:showTab', 'text');
                break;
            case 'add-image':
                this.events.emit('sidebar:showTab', 'uploads');
                break;
            case 'add-shape':
                this.events.emit('sidebar:showTab', 'shapes');
                break;
            case 'toggle-grid':
                btn.classList.toggle('active');
                this.events.emit('canvas:toggleGrid');
                break;
            case 'toggle-guides':
                // Guides disabled - Lumise doesn't use snap guides during movement
                btn.classList.toggle('active');
                break;

            // Text tools
            case 'bold':
                if (obj && obj.type === 'i-text') {
                    const isBold = obj.fontWeight === 'bold';
                    obj.set('fontWeight', isBold ? 'normal' : 'bold');
                    btn.classList.toggle('active', !isBold);
                    this.canvas.render();
                    this.events.emit('history:save');
                }
                break;
            case 'italic':
                if (obj && obj.type === 'i-text') {
                    const isItalic = obj.fontStyle === 'italic';
                    obj.set('fontStyle', isItalic ? 'normal' : 'italic');
                    btn.classList.toggle('active', !isItalic);
                    this.canvas.render();
                    this.events.emit('history:save');
                }
                break;
            case 'underline':
                if (obj && obj.type === 'i-text') {
                    obj.set('underline', !obj.underline);
                    btn.classList.toggle('active', obj.underline);
                    this.canvas.render();
                    this.events.emit('history:save');
                }
                break;
            case 'align-left':
                if (obj && obj.type === 'i-text') {
                    obj.set('textAlign', 'left');
                    this.canvas.render();
                    this.events.emit('history:save');
                }
                break;
            case 'align-center':
                if (obj && obj.type === 'i-text') {
                    obj.set('textAlign', 'center');
                    this.canvas.render();
                    this.events.emit('history:save');
                }
                break;
            case 'align-right':
                if (obj && obj.type === 'i-text') {
                    obj.set('textAlign', 'right');
                    this.canvas.render();
                    this.events.emit('history:save');
                }
                break;

            // Image tools
            case 'replace-image':
                document.getElementById('image-upload-input').click();
                break;
            case 'flip-h':
                if (obj) {
                    obj.set('flipX', !obj.flipX);
                    this.canvas.render();
                    this.events.emit('history:save');
                }
                break;
            case 'flip-v':
                if (obj) {
                    obj.set('flipY', !obj.flipY);
                    this.canvas.render();
                    this.events.emit('history:save');
                }
                break;

            // Multiple selection tools
            case 'group':
                this.canvas.group();
                break;
            case 'delete-selected':
                this.canvas.deleteSelected();
                break;
        }
    }

    /**
     * Set up input change handlers
     */
    setupInputHandlers() {
        // Font family
        const fontFamily = document.getElementById('font-family');
        if (fontFamily) {
            fontFamily.addEventListener('change', (e) => {
                const obj = this.canvas.getSelected();
                if (obj && obj.type === 'i-text') {
                    obj.set('fontFamily', e.target.value);
                    this.canvas.render();
                    this.events.emit('history:save');
                }
            });
        }

        // Font size
        const fontSize = document.getElementById('font-size');
        if (fontSize) {
            fontSize.addEventListener('change', (e) => {
                const obj = this.canvas.getSelected();
                if (obj && obj.type === 'i-text') {
                    obj.set('fontSize', parseInt(e.target.value));
                    this.canvas.render();
                    this.events.emit('history:save');
                }
            });
        }

        // Text color
        const textColor = document.getElementById('text-color');
        if (textColor) {
            textColor.addEventListener('input', (e) => {
                const obj = this.canvas.getSelected();
                if (obj && obj.type === 'i-text') {
                    obj.set('fill', e.target.value);
                    this.canvas.render();
                }
            });
            textColor.addEventListener('change', () => {
                this.events.emit('history:save');
            });
        }

        // Image opacity
        const imageOpacity = document.getElementById('image-opacity');
        if (imageOpacity) {
            imageOpacity.addEventListener('input', (e) => {
                const obj = this.canvas.getSelected();
                if (obj) {
                    obj.set('opacity', parseInt(e.target.value) / 100);
                    this.canvas.render();
                }
            });
            imageOpacity.addEventListener('change', () => {
                this.events.emit('history:save');
            });
        }

        // Image filter
        const imageFilter = document.getElementById('image-filter');
        if (imageFilter) {
            imageFilter.addEventListener('change', (e) => {
                const obj = this.canvas.getSelected();
                if (obj && obj.type === 'image') {
                    this.applyImageFilter(obj, e.target.value);
                }
            });
        }

        // Shape fill
        const shapeFill = document.getElementById('shape-fill');
        if (shapeFill) {
            shapeFill.addEventListener('input', (e) => {
                const obj = this.canvas.getSelected();
                if (obj) {
                    obj.set('fill', e.target.value);
                    this.canvas.render();
                }
            });
            shapeFill.addEventListener('change', () => {
                this.events.emit('history:save');
            });
        }

        // Shape stroke
        const shapeStroke = document.getElementById('shape-stroke');
        if (shapeStroke) {
            shapeStroke.addEventListener('input', (e) => {
                const obj = this.canvas.getSelected();
                if (obj) {
                    obj.set('stroke', e.target.value);
                    this.canvas.render();
                }
            });
            shapeStroke.addEventListener('change', () => {
                this.events.emit('history:save');
            });
        }

        // Stroke width
        const strokeWidth = document.getElementById('stroke-width');
        if (strokeWidth) {
            strokeWidth.addEventListener('change', (e) => {
                const obj = this.canvas.getSelected();
                if (obj) {
                    obj.set('strokeWidth', parseInt(e.target.value));
                    this.canvas.render();
                    this.events.emit('history:save');
                }
            });
        }

        // Shape opacity
        const shapeOpacity = document.getElementById('shape-opacity');
        if (shapeOpacity) {
            shapeOpacity.addEventListener('input', (e) => {
                const obj = this.canvas.getSelected();
                if (obj) {
                    obj.set('opacity', parseInt(e.target.value) / 100);
                    this.canvas.render();
                }
            });
            shapeOpacity.addEventListener('change', () => {
                this.events.emit('history:save');
            });
        }
    }

    /**
     * Apply image filter
     */
    applyImageFilter(obj, filterType) {
        // Clear existing filters
        obj.filters = [];

        switch (filterType) {
            case 'grayscale':
                obj.filters.push(new fabric.Image.filters.Grayscale());
                break;
            case 'sepia':
                obj.filters.push(new fabric.Image.filters.Sepia());
                break;
            case 'invert':
                obj.filters.push(new fabric.Image.filters.Invert());
                break;
            case 'brightness':
                obj.filters.push(new fabric.Image.filters.Brightness({ brightness: 0.1 }));
                break;
        }

        obj.applyFilters();
        this.canvas.render();
        this.events.emit('history:save');
    }
}
