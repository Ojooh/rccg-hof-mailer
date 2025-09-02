
const LoggerUtil            = require("../utils/logger_util");
const EmailEnqueuer         = require("../modules/email_enqueuer");
const EmailProcessor        = require("../modules/email_processor")


class EventHandler {
    constructor(event_system_instance = null) {
        this.module_name = "event_handler";

        this.logger = new LoggerUtil(this.module_name);
        this.event_system_instance = event_system_instance;

        this.email_enqueuer = new EmailEnqueuer(this.event_system_instance);
        this.email_processor = new EmailProcessor();

        // Queues
        this.enqueue_queue = [];
        this.process_queue = [];

        // Flags
        this.processing_enqueue = false;
        this.processing_emails = false;

        // Delay before batch processing (ms)
        this.BATCH_DELAY = 200; 
    }

    // Add member to enqueue queue
    queueWelcomeEmail = (member) => {
        this.enqueue_queue.push(member);

        if (!this.processing_enqueue) {
            this.processing_enqueue = true;
            setTimeout(() => this._processEnqueueQueue(), this.BATCH_DELAY);
        }
    };

    // Process all members in the enqueue queue
    _processEnqueueQueue = async () => {
        const membersToProcess = [...this.enqueue_queue];
        this.enqueue_queue = []; // reset queue

        try {
            await this.email_enqueuer.enqueueEmails(membersToProcess, 1);
        } catch (err) {
            this.logger.error("Failed to enqueue batch", { error: err });
        } finally {
            this.processing_enqueue = false;
            if (this.enqueue_queue.length > 0) {
                // Process remaining members if any came in during this batch
                setTimeout(() => this._processEnqueueQueue(), this.BATCH_DELAY);
            }
        }
    };

    // Add a queue_count to process queue
    queueProcessEmails = (queue_count) => {
        this.process_queue.push(queue_count);

        if (!this.processing_emails) {
            this.processing_emails = true;
            setTimeout(() => this._processEmailQueue(), this.BATCH_DELAY);
        }
    };

    // Process all emails in the process queue
    _processEmailQueue = async () => {
        const queuesToProcess = [...this.process_queue];
        this.process_queue = []; // reset queue

        try {
            await this.email_processor.processPendingEmails();
        } catch (err) {
            this.logger.error("Failed to process email batch", { error: err });
        } finally {
            this.processing_emails = false;
            if (this.process_queue.length > 0) {
                // Process remaining events if any came in during this batch
                setTimeout(() => this._processEmailQueue(), this.BATCH_DELAY);
            }
        }
    };

    // Listen to events
    handleEvents = () => {
        this.event_system_instance.on("new_member_registered", this.queueWelcomeEmail);
        this.event_system_instance.on("email_enqueued", this.queueProcessEmails);
    };
}



module.exports = EventHandler;