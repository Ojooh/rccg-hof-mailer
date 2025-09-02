// app.js - Entry point of the application
const path                  = require("path");
const LoggerUtil            = require("./utils/logger_util");
const EventSystemUtil       = require("./utils/event_system_util");
const EventHandler          = require("./modules/event_handler");
const MemberDataFetcher     = require("./modules/members_data_fetcher");
const MemberManager         = require("./modules/member_manager");

class MainApp {
    constructor() {
        this.module_name        = "main_app";

        this.logger             = new LoggerUtil(this.module_name);
        this.event_system       = new EventSystemUtil();
        this.member_fetcher     = new MemberDataFetcher(this.event_system);
        this.event_handler      = new EventHandler(this.event_system);
        this.member_manager     = new MemberManager();   
    }

    runMailer = async () => {
        const filter = { is_a_worker: true, service_unit: "Multimedia", emails_in: ["dotun.adio@gmail.com", "drsalami.oluwafunsho@gmail.com", "davidmatthoo@outlook.com"] }
        const workers = this.member_manager.findAll(filter);
        console.log(`Sending Email to ${workers.length} Member Record(s) found`);

        await this.event_handler.email_enqueuer.enqueueEmails(workers, 1);
        await this.event_handler.email_enqueuer.enqueueEmails(workers, 2);
    }

    run = async () => {
        try {
            this.logger.info("Application started...");

            // handle events
            this.event_handler.handleEvents();

            // update member data
            await this.member_fetcher.saveData();

            await this.runMailer();

            this.logger.info("Application ended...");
        }
        catch (error) {
            this.logger.error("Error running the application:", { error });
        }

        
    }
}


module.exports = MainApp

new MainApp().run();
