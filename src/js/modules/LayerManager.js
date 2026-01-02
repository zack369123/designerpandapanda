/**
 * LayerManager - Layer panel management
 * Handles layer list, reordering, visibility, and selection
 */

export class LayerManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.events = window.designerEvents;

        this.init();
    }

    /**
     * Initialize layer manager
     */
    init() {
        this.layersList = document.getElementById('layers-list');

        // Listen for layer updates
        this.events.on('layers:update', () => {
            this.render();
        });

        // Listen for selection changes
        this.events.on('selection:changed', (data) => {
            this.highlightSelectedLayers(data.objects);
        });

        // Layer action buttons
        document.querySelector('[data-action="layer-up"]')?.addEventListener('click', () => {
            this.moveLayerUp();
        });

        document.querySelector('[data-action="layer-down"]')?.addEventListener('click', () => {
            this.moveLayerDown();
        });

        // Initial render
        this.render();
    }

    /**
     * Render layers list
     */
    render() {
        const objects = this.canvas.getObjects();

        if (objects.length === 0) {
            this.layersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-layer-group"></i>
                    <p>No layers yet</p>
                </div>
            `;
            return;
        }

        // Render in reverse order (top layer first)
        const layers = [...objects].reverse();

        this.layersList.innerHTML = layers.map((obj, index) => {
            const realIndex = objects.length - 1 - index;
            const type = this.getObjectType(obj);
            const icon = this.getObjectIcon(obj);
            const name = this.getObjectName(obj, realIndex);
            const isLocked = obj.lockMovementX;
            const isVisible = obj.visible !== false;

            return `
                <div class="layer-item ${isLocked ? 'locked' : ''}"
                     data-index="${realIndex}"
                     data-id="${obj.id || realIndex}">
                    <div class="layer-thumb">
                        <i class="${icon}"></i>
                    </div>
                    <div class="layer-info">
                        <div class="layer-name">${name}</div>
                        <div class="layer-type">${type}</div>
                    </div>
                    <div class="layer-actions-inline">
                        <button class="btn-icon small" data-layer-action="visibility" title="${isVisible ? 'Hide' : 'Show'}">
                            <i class="fas fa-${isVisible ? 'eye' : 'eye-slash'}"></i>
                        </button>
                        <button class="btn-icon small" data-layer-action="lock" title="${isLocked ? 'Unlock' : 'Lock'}">
                            <i class="fas fa-${isLocked ? 'lock' : 'lock-open'}"></i>
                        </button>
                        <button class="btn-icon small" data-layer-action="delete" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners
        this.setupLayerEvents();
    }

    /**
     * Set up layer event listeners
     */
    setupLayerEvents() {
        this.layersList.querySelectorAll('.layer-item').forEach(item => {
            // Select on click
            item.addEventListener('click', (e) => {
                // Don't select if clicking action buttons
                if (e.target.closest('[data-layer-action]')) return;

                const index = parseInt(item.dataset.index);
                const objects = this.canvas.getObjects();
                const obj = objects[index];

                if (obj) {
                    this.canvas.fabricCanvas.setActiveObject(obj);
                    this.canvas.render();
                }
            });

            // Action buttons
            item.querySelectorAll('[data-layer-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.layerAction;
                    const index = parseInt(item.dataset.index);
                    this.handleLayerAction(action, index);
                });
            });
        });

        // Make layers draggable for reordering
        this.setupDragReorder();
    }

    /**
     * Handle layer action
     */
    handleLayerAction(action, index) {
        const objects = this.canvas.getObjects();
        const obj = objects[index];

        if (!obj) return;

        switch (action) {
            case 'visibility':
                obj.set('visible', !obj.visible);
                this.canvas.render();
                this.render();
                break;

            case 'lock':
                const isLocked = obj.lockMovementX;
                obj.set({
                    lockMovementX: !isLocked,
                    lockMovementY: !isLocked,
                    lockRotation: !isLocked,
                    lockScalingX: !isLocked,
                    lockScalingY: !isLocked,
                    hasControls: isLocked,
                    selectable: isLocked
                });
                this.canvas.render();
                this.render();
                break;

            case 'delete':
                this.canvas.fabricCanvas.remove(obj);
                this.canvas.render();
                this.events.emit('history:save');
                break;
        }
    }

    /**
     * Move selected layer up
     */
    moveLayerUp() {
        const obj = this.canvas.getSelected();
        if (obj) {
            obj.bringForward();
            this.canvas.render();
            this.render();
            this.events.emit('history:save');
        }
    }

    /**
     * Move selected layer down
     */
    moveLayerDown() {
        const obj = this.canvas.getSelected();
        if (obj) {
            obj.sendBackwards();
            this.canvas.render();
            this.render();
            this.events.emit('history:save');
        }
    }

    /**
     * Highlight selected layers
     */
    highlightSelectedLayers(selected) {
        this.layersList.querySelectorAll('.layer-item').forEach(item => {
            item.classList.remove('selected');
        });

        if (!selected || selected.length === 0) return;

        const objects = this.canvas.getObjects();
        selected.forEach(obj => {
            const index = objects.indexOf(obj);
            const item = this.layersList.querySelector(`[data-index="${index}"]`);
            if (item) {
                item.classList.add('selected');
            }
        });
    }

    /**
     * Set up drag reordering
     */
    setupDragReorder() {
        let draggedItem = null;

        this.layersList.querySelectorAll('.layer-item').forEach(item => {
            item.draggable = true;

            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!draggedItem || draggedItem === item) return;

                const fromIndex = parseInt(draggedItem.dataset.index);
                const toIndex = parseInt(item.dataset.index);

                this.reorderLayer(fromIndex, toIndex);
            });
        });
    }

    /**
     * Reorder layer
     */
    reorderLayer(fromIndex, toIndex) {
        const objects = this.canvas.getObjects();
        const obj = objects[fromIndex];

        if (!obj) return;

        // Calculate how many positions to move
        const diff = toIndex - fromIndex;

        if (diff > 0) {
            // Moving up in stack
            for (let i = 0; i < diff; i++) {
                obj.bringForward();
            }
        } else {
            // Moving down in stack
            for (let i = 0; i < Math.abs(diff); i++) {
                obj.sendBackwards();
            }
        }

        this.canvas.render();
        this.render();
        this.events.emit('history:save');
    }

    /**
     * Get object type display name
     */
    getObjectType(obj) {
        const types = {
            'i-text': 'Text',
            'text': 'Text',
            'textbox': 'Textbox',
            'image': 'Image',
            'rect': 'Rectangle',
            'circle': 'Circle',
            'triangle': 'Triangle',
            'polygon': 'Polygon',
            'path': 'Shape',
            'group': 'Group',
            'line': 'Line'
        };
        return types[obj.type] || 'Object';
    }

    /**
     * Get object icon
     */
    getObjectIcon(obj) {
        const icons = {
            'i-text': 'fas fa-font',
            'text': 'fas fa-font',
            'textbox': 'fas fa-font',
            'image': 'fas fa-image',
            'rect': 'far fa-square',
            'circle': 'far fa-circle',
            'triangle': 'fas fa-play fa-rotate-270',
            'polygon': 'fas fa-draw-polygon',
            'path': 'fas fa-bezier-curve',
            'group': 'fas fa-object-group',
            'line': 'fas fa-minus'
        };
        return icons[obj.type] || 'fas fa-cube';
    }

    /**
     * Get object display name
     */
    getObjectName(obj, index) {
        if (obj.name) return obj.name;

        // For text, use the text content
        if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
            const text = obj.text || '';
            return text.substring(0, 20) + (text.length > 20 ? '...' : '');
        }

        return `${this.getObjectType(obj)} ${index + 1}`;
    }
}
