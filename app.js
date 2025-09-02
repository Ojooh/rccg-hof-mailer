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
        const workers = this.member_manager.findAll({ is_a_worker: true });
        console.log(workers.length);
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
