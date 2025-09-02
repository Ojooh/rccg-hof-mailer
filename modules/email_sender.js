const fs            = require("fs");
const path          = require("path");
const nodemailer    = require("nodemailer");
const ejs           = require("ejs");

class EmailSender {
    constructor({ user, pass }) {
        this.transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user, pass }
        });

        this.templatesFile = path.join(__dirname, "email_templates.json");
        this.sentLogFile   = path.join(__dirname, "sent_emails.json");
    }

    _loadTemplates = () => {
        if (!fs.existsSync(this.templatesFile)) return [];
        return JSON.parse(fs.readFileSync(this.templatesFile, "utf8"));
    };

    _getTemplateById = (id) => {
        const templates = this._loadTemplates();
        return templates.find(t => t.id === id);
    };

    _logSentEmail = (record) => {
        let logs = [];
        if (fs.existsSync(this.sentLogFile)) {
            logs = JSON.parse(fs.readFileSync(this.sentLogFile, "utf8"));
        }
        logs.push(record);
        fs.writeFileSync(this.sentLogFile, JSON.stringify(logs, null, 2));
    };

    sendEmails = async (members, templateId) => {
        const template = this._getTemplateById(templateId);
        if (!template) throw new Error(`Template with id ${templateId} not found`);

        const templatePath = path.resolve(template.template_path);

        for (const member of members) {
            try {
                // Render EJS template
                const html = await ejs.renderFile(templatePath, member);
                const subject = ejs.render(template.subject, member);

                // Send email
                const info = await this.transporter.sendMail({
                    from: `"Community Support" <${this.transporter.options.auth.user}>`,
                    to: member.email_address,
                    subject,
                    html
                });

                console.log(`✅ Sent to ${member.email_address}: ${info.messageId}`);

                this._logSentEmail({
                    member_id: member.id,
                    email_address: member.email_address,
                    template_id: templateId,
                    subject,
                    sent_at: new Date().toISOString(),
                    status: "success"
                });

            } catch (err) {
                console.error(`❌ Failed to send to ${member.email_address}: ${err.message}`);

                this._logSentEmail({
                    member_id: member.id,
                    email_address: member.email_address,
                    template_id: templateId,
                    subject: template.subject,
                    sent_at: new Date().toISOString(),
                    status: "failed",
                    error: err.message
                });
            }
        }
    };
}

module.exports = EmailSender;
