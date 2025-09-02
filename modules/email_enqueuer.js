const fs                = require("fs");
const path              = require("path");
const LockedFileUtil    = require("../utils/locked_file_util");
const EjsRendererUtil   = require("../utils/ejs_renderer_util");
const LoggerUtil        = require("../utils/logger_util");

const {
    EMAIL_STATUS
} = require("../enums/constants");

class EmailEnqueuer {
    constructor(event_system_instance = null) {
        this.module_name            = "email_enqueuer";
        this.base_dir               = process.cwd();
        this.db_dir                 = this._ensureDirExist(path.join(this.base_dir, "local_db"));
        this.templates_file         = path.join(this.db_dir, "email_templates.json");
        this.sent_log_file          = path.join(this.db_dir, "sent_emails.json");

        this.ejs_renderer           = new EjsRendererUtil(this.module_name);
        this.logger                 = new LoggerUtil(this.module_name);
        this.file_locker            = new LockedFileUtil(this.logger);
        this.event_system_instance 	= event_system_instance;
        this.enqueued_count         = 0;

        this._preLoadSentEmails();
    }

    // Private Method to ensure directory exists
    _ensureDirExist = (dir) => {
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        return dir;
    };

    // Private method to preload sent emails if empty
    _preLoadSentEmails = () => {
        if (!fs.existsSync(this.sent_log_file)) {
            fs.writeFileSync(this.sent_log_file, "[]");
            this.logger.info("Created new sent_emails.json file");
        }
    }

    // Private Method to load templates data
    _loadTemplates = () => {
        try {
            if (!fs.existsSync(this.templates_file)) {
                this.logger.alert(`Templates file not found at ${this.templates_file}`);
                return [];
            }
            const templates = JSON.parse(fs.readFileSync(this.templates_file, "utf8"));
            this.logger.info(`Loaded ${templates.length} templates`);
            return templates;
        } catch (error) {
            this.logger.error("Failed to load templates", { error });
            return [];
        }
    };

    // Private Method to fetch existing email logs
    _loadExistingEmailSentLogs = () => {
        let logs;
        try {
            logs = JSON.parse(fs.readFileSync(this.sent_log_file, "utf8"));
        } 
        catch (error) {
            this.logger.error("Failed to parse sent_emails.json, resetting file", { error });
            logs = [];
        }

        return logs
    }

    // Private Method to get template by id
    _getTemplateById = (id) => {
        const templates = this._loadTemplates();
        const template  = templates.find(t => t.id === id);

        if (!template) {
            this.logger.error(`Template with id ${id} not found`);
            return null;
        }
        return template;
    };

    // Private method to trigger email qued event
    _triggerEmailsQueuedEvent = () => {
        if (this.event_system_instance && this.enqueued_count) {
            this.event_system_instance.emit("email_enqueued", this.enqueued_count);
        }
        this.enqueued_count  = 0;
    }

    // Method to enqueue emails
    enqueueEmails = async (members, template_id) => {
        const template = this._getTemplateById(template_id);

        if (!template) {
            throw new Error(`Template with id ${template_id} not found`);
        }

        try {
            // Safely read existing logs using LockedFileUtil
            const logs = await this.file_locker.readJson(this.sent_log_file);

            this.logger.info(`Acquired lock on ${this.sent_log_file}`);

            for (const member of members) {
                if (!member.email_address || !member.id) {
                    this.logger.alert(`Skipping member (missing email or id)`, { member });
                    continue;
                }

                const is_exist = logs.find((obj) => { return obj.member === member.id && template_id})

                if(is_exist) {
                    this.logger.alert(`Skipping member (Email alread sent)`, { member });
                    continue;
                }

                const now_date = new Date().toISOString();
                const unique_id = `${member.id}_${template_id}_${Date.now()}`;
                const subject = this.ejs_renderer.renderString(template.subject, member);

                logs.push({
                    id: unique_id,
                    member_id: member.id,
                    email_address: member.email_address,
                    template_id,
                    subject,
                    status: EMAIL_STATUS.PENDING,
                    created_at: now_date,
                    updated_at: null,
                    queued_at: now_date,
                    sent_at: null
                });

                this.enqueued_count++;

                this.logger.info(`Enqueued email for member ${member.id}`, { email: member.email_address });
            }

            // Safely update file using LockedFileUtil
            await this.file_locker.updateJson(this.sent_log_file, logs);
            this.logger.success(`Enqueued ${this.enqueued_count} emails using template ${template_id}`);

            return this.enqueued_count;
        } 
        catch (error) {
            this.logger.error("Failed to enqueue emails", { error });
            return 0;
        }
        finally {
            this._triggerEmailsQueuedEvent();
        }
    };
}

module.exports = EmailEnqueuer;
