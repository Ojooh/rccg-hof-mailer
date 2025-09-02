const ejs        = require("ejs");
const fs         = require("fs");
const path       = require("path");
const LoggerUtil = require("./logger_util");

class EjsRendererUtil {
    constructor(rootDir = null) {
        this.module_name = "ejs_renderer";
        this.logger      = new LoggerUtil(this.module_name);

        // Set the root directory for includes; default to templates folder in project root
        this.root = rootDir || path.join(process.cwd(), "templates");
    }

    // Ensure missing keys in data object resolve to empty string
    _safeData = (data) => {
        return new Proxy(data || {}, {
            get: (target, prop) => (prop in target ? target[prop] : "")
        });
    };

    // Render an EJS template from a string
    renderString = (template_string, data = {}) => {
        try {
            const safe_data = this._safeData(data);
            const result    = ejs.render(template_string, safe_data, { root: this.root });
            this.logger.success("Rendered template string successfully");
            return result;
        } 
        catch (error) {
            this.logger.error("Error rendering EJS string", { error, data, template_string });
            return "";
        }
    };

    // Render an EJS template from a file (returns a Promise)
    renderFile = async (file_path, data = {}) => {
        if (!fs.existsSync(file_path)) {
            this.logger.error("Template file not found", { file_path });
            return "";
        }

        const safeData = this._safeData(data);

        try {
            const result = await new Promise((resolve, reject) => {
                ejs.renderFile(file_path, safeData, { root: this.root }, (err, str) => {
                    if (err) return reject(err);
                    resolve(str);
                });
            });
            this.logger.success(`Rendered file: ${file_path}`);
            return result;
        } catch (error) {
            this.logger.error("Error rendering EJS file", { error, data, file_path });
            return "";
        }
    };

}

module.exports = EjsRendererUtil;
