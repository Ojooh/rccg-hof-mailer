
const fs            = require('fs');
const path          = require('path');

class LoggerUtil {
    constructor(module_name) {
        this.module_name        = module_name;
        this.base_dir           = process.cwd();
        this.logs_dir           = path.join(this.base_dir, "logs")
        this.log_file_path      = this.getLogFileName(this.logs_dir)
    }

    // Method to get log file name
    getLogFileName = (log_dir) => {
        if (!fs.existsSync(log_dir)) { fs.mkdirSync(log_dir, { recursive: true }); }

        const file_name = `${this.module_name}-${Math.floor(Date.now() / 1000)}.log`;

        return path.join(log_dir, file_name)
    }

    safeStringify = (obj, space = 2) => {
        const seen = new WeakSet();
        return JSON.stringify(obj, function (key, value) {
            if (typeof value === "object" && value !== null) {

                if (seen.has(value)) { return "[Circular]"; }

                seen.add(value);
            }
             return value;
        }, space);
    }

    // General method to log messages
    log = (message = "", data_error = {}, status = "info", ) => {
        const timestamp             = new Date().toISOString();
        const error_str             = data_error && Object.keys(data_error).length ? this.safeStringify(data_error, 0) : "";
        const log_message           = `${timestamp} [${status}] ${message} ${error_str}\n`;
        const log_object            = { timestamp, status, message, data_error }

        fs.appendFileSync(this.log_file_path, log_message);

        if (status == "ERROR") { console.log(`\n${timestamp} [${status}] ${message}\n`); }

        if(status === "ERROR" && data_error && Object.keys(data_error).length) {
           console.log({ data_error});
           console.log("\n");
           console.log("========================================");
        }

        return log_object;
    }

    // Convenience methods for different log levels
    info = (message, data = "") => { return this.log(message, data, "INFO"); }

    error = (message, error = "") => { return this.log(message, error, "ERROR"); }

    alert = (message, data = "") => { return this.log(message, data, "ALERT"); }

    success = (message, data = "") => { return this.log(message, data, "SUCCESS" ); }

    logExecutionTime = (start_time, class_name, method_name) => {
        const [seconds, nanoseconds]    = process.hrtime(start_time);
        const duration_ms               = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
        this.info(`${class_name} - ${method_name} completed in ${duration_ms}ms`);
    }
}

module.exports = LoggerUtil;
