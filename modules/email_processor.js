const fs                = require("fs");
const path              = require("path");
const lockfile          = require("proper-lockfile");
const nodemailer        = require("nodemailer");
const LockedFileUtil    = require("../utils/locked_file_util");
const EjsRendererUtil   = require("../utils/ejs_renderer_util");
const LoggerUtil        = require("../utils/logger_util");

const { 
    GMAIL_CONFIG,
    PREVIEW_MODE
} = require("../enums/constants");

class EmailProcessor {
    constructor() {
        this.module_name    = "email_processor";
        this.base_dir       = process.cwd();
        this.preview        = PREVIEW_MODE;
        this.transporter    = this._getMailerTransporter();
        this.db_dir         = this._ensureDirExist(path.join(this.base_dir, "local_db"));
        this.preview_dir    = this._ensureDirExist(path.join(this.base_dir, "preview_mails"));

        this.templates_file = path.join(this.db_dir, "email_templates.json");
        this.members_file   = path.join(this.db_dir, "hof_member_data.json");
        this.sent_log_file  = path.join(this.db_dir, "sent_emails.json");

        this.ejs_renderer   = new EjsRendererUtil(this.module_name);
        this.logger         = new LoggerUtil(this.module_name);
        this.file_locker    = new LockedFileUtil(this.logger);
    }

    // Ensure directory exists
    _ensureDirExist = (dir) => {
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        return dir;
    };

    // Create nodemailer transporter (only used if preview=false)
    _getMailerTransporter = () => {
        if (this.preview) return null; // no transporter in preview mode
        const user = GMAIL_CONFIG.email_address;
        const pass = GMAIL_CONFIG.password;
        return nodemailer.createTransport({
            service: "gmail",
            auth: { user, pass }
        });
    };

    _loadTemplates = () => {
        if (!fs.existsSync(this.templates_file)) return [];
        return JSON.parse(fs.readFileSync(this.templates_file, "utf8"));
    };

    _loadMembers = () => {
        if (!fs.existsSync(this.members_file)) return [];
        return JSON.parse(fs.readFileSync(this.members_file, "utf8"));
    };

    _getTemplateById = (id) => {
        const templates = this._loadTemplates();
        return templates.find(t => t.id === id);
    };

    _getMemberById = (id) => {
        const members = this._loadMembers();
        return members.find(m => m.id === id);
    };

    // Render email and either send or save to preview
    _renderAndSendMail = async (entry, template_record, member_record) => {
        try {
            const template_path = path.join(this.base_dir, template_record.template_path);

            // Render subject + HTML
            const full_data = { ...member_record, ...template_record, ...entry}
            const subject   = entry?.subject || this.ejs_renderer.renderString(template_record.subject, member_record);
            const html      = await this.ejs_renderer.renderFile(template_path, full_data);

            if (this.preview) {
                // Save rendered HTML to preview file
                const file_name = `${member_record.first_name}_${member_record.last_name}_${Date.now()}.html`;
                const file_path = path.join(this.preview_dir, file_name);
                fs.writeFileSync(file_path, html, "utf8");

                entry.status     = "preview";
                entry.preview_at = new Date().toISOString();
                entry.subject    = subject;

                this.logger.success(`Preview saved for ${member_record.email_address}`, { file_path, member_id: member_record.id, subject });
            } 
            else {
                // Send via nodemailer
                const info = await this.transporter.sendMail({
                    from: `"${GMAIL_CONFIG.username}" <${GMAIL_CONFIG.email_address}>`,
                    to: member_record.email_address,
                    subject,
                    html
                });

                const now_date = new Date().toISOString();
                entry.status     = "success";
                entry.sent_at    = now_date;
                entry.subject    = subject;
                entry.updated_at = now_date;
                entry.message_id = info.messageId;

                this.logger.success(`Email sent to ${member_record.email_address}`, { member_id: member_record.id, subject });
            }

        } catch (error) {
            entry.status     = "failed";
            entry.error      = error.message;
            entry.subject    = template_record.subject;
            entry.updated_at = new Date().toISOString();

            this.logger.error(`Failed for ${member_record.email_address}`, { error });
        }

        return true;
    };

    // Process pending emails
    processPendingEmails = async () => {
        let release;
        try {
            if (!fs.existsSync(this.sent_log_file)) {
                this.logger.info("No pending emails found.");
                return;
            }

            // Safely read existing logs using LockedFileUtil
            const logs = await this.file_locker.readJson(this.sent_log_file);
            let updated = false;

            this.logger.info(`Found ${logs.length} to be processed`)

            for (let entry of logs) {
                if (entry.status !== "pending") continue;

                const member   = this._getMemberById(entry.member_id);
                const template = this._getTemplateById(entry.template_id);

                if (!member) {
                    entry.status = "failed";
                    entry.error  = "Member not found";
                    this.logger.error(`Member ID ${entry.member_id} not found`);
                    updated = true;
                    continue;
                }

                if (!template) {
                    entry.status = "failed";
                    entry.error  = "Template not found";
                    this.logger.error(`Template ID ${entry.template_id} not found`);
                    updated = true;
                    continue;
                }

                await this._renderAndSendMail(entry, template, member);
                updated = true;
            }

            if (updated) {
                await this.file_locker.updateJson(this.sent_log_file, logs);
                this.logger.success("Updated sent_emails.json after processing queue");
            }

        } catch (error) {
            this.logger.error("Failed to process enqueued emails", { error: error.message });
        } 
    };
}

module.exports = EmailProcessor;
