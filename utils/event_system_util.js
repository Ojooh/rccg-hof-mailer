const LoggerUtil = require("../utils/logger_util");

class EventSystemUtil {
    constructor(module_name = "event_system") {
        this.events = {};
        this.logger = new LoggerUtil(module_name);
    }

    // Register an event listener for a specific event
    on = (event, listener) => {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        this.logger.info(`Listener registered for event: ${event}`);
    }

    // Trigger an event and call all listeners
    emit = (event, data, options) => {
        if (this.events[event]) {
            this.logger.success(`Event triggered: ${event}`, { data, options });
            this.events[event].forEach(listener => {
                try {
                    listener(data, options);
                } catch (err) {
                    this.logger.error(`Error executing listener for event: ${event}`, { error: err.message });
                }
            });
        } else {
            this.logger.alert(`No listeners registered for event: ${event}`);
        }
    }

    // Remove a specific listener for an event
    off = (event, listener) => {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(l => l !== listener);
            this.logger.info(`Listener removed from event: ${event}`);
        }
    }
}

module.exports = EventSystemUtil;
