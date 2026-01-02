/**
 * HistoryManager - Undo/Redo functionality
 * Manages canvas state history for undoing and redoing changes
 */

export class HistoryManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.events = window.designerEvents;

        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        this.isRestoring = false;

        this.init();
    }

    /**
     * Initialize history manager
     */
    init() {
        // Listen for save events
        this.events.on('history:save', () => {
            this.save();
        });

        // Save initial state
        setTimeout(() => {
            this.save();
        }, 100);

        // Update button states
        this.updateButtonStates();
    }

    /**
     * Save current canvas state to history
     */
    save() {
        if (this.isRestoring) return;

        const state = JSON.stringify(this.canvas.toJSON());

        // If we're not at the end of history, remove future states
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Don't save if state hasn't changed
        if (this.history.length > 0 && this.history[this.historyIndex] === state) {
            return;
        }

        // Add new state
        this.history.push(state);

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this.updateButtonStates();
        this.events.emit('history:saved', { index: this.historyIndex, total: this.history.length });
    }

    /**
     * Undo last action
     */
    undo() {
        if (!this.canUndo()) return;

        this.isRestoring = true;
        this.historyIndex--;

        const state = JSON.parse(this.history[this.historyIndex]);
        this.canvas.loadFromJSON(state).then(() => {
            this.isRestoring = false;
            this.updateButtonStates();
            this.events.emit('history:undo', { index: this.historyIndex });
            this.events.emit('layers:update');
        });
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (!this.canRedo()) return;

        this.isRestoring = true;
        this.historyIndex++;

        const state = JSON.parse(this.history[this.historyIndex]);
        this.canvas.loadFromJSON(state).then(() => {
            this.isRestoring = false;
            this.updateButtonStates();
            this.events.emit('history:redo', { index: this.historyIndex });
            this.events.emit('layers:update');
        });
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.historyIndex > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Update undo/redo button states
     */
    updateButtonStates() {
        const undoBtn = document.querySelector('[data-action="undo"]');
        const redoBtn = document.querySelector('[data-action="redo"]');

        if (undoBtn) {
            undoBtn.disabled = !this.canUndo();
        }

        if (redoBtn) {
            redoBtn.disabled = !this.canRedo();
        }
    }

    /**
     * Clear history
     */
    clear() {
        this.history = [];
        this.historyIndex = -1;
        this.save();
    }

    /**
     * Get history info
     */
    getInfo() {
        return {
            current: this.historyIndex,
            total: this.history.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
}
