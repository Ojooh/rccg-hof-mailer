const ejs           = require("ejs");
const fs            = require("fs");
const path          = require("path");
const LoggerUtil    = require("./logger_util");

class EjsRendererUtil {
    constructor() {
        this.module_name    = "ejs_renderer";
        this.logger         = new LoggerUtil(this.module_name);
    }

    // Method to Ensure missing keys in data object resolve to empty string
    _safeData = (data) => {
        return new Proxy(data || {}, {
            get: (target, prop) => {
                if (prop in target) {
                    return target[prop];
                }
                return "";
            }
        });
    }

    //Method to Render an EJS template from a string
    renderString = (template_string, data = {}) => {
        try {
            const safe_data = this._safeData(data);
            const result = ejs.render(template_string, safe_data);
            this.logger.success("Rendered template string successfully");
            return result;
        } 
        catch (error) {
            this.logger.error("Error rendering EJS string", { error });
            return "";
        }
    }

    // Method to Render an EJS template from a file
    renderFile = (file_path, data = {}) => {
        try {
            if (!fs.existsSync(file_path)) {
                throw new Error(`Template file not found: ${file_path}`);
            }
            const template  = fs.readFileSync(file_path, "utf8");
            return this.renderString(template, data);
        } catch (error) {
            this.logger.error("Error rendering EJS file", { error: error.message });
            return "";
        }
    }
}

module.exports = EjsRendererUtil;
