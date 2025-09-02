const fs            = require("fs");
const path          = require("path");
const LoggerUtil    = require("../utils/logger_util");

class MemberManager {
    constructor() {
        this.module_name    = "member_manager";
        this.base_dir       = process.cwd();
        this.db_dir         = path.join(this.base_dir, "local_db");
        this.members_file   = path.join(this.db_dir, "hof_member_data.json");

        this.logger         = new LoggerUtil(this.module_name);
    }

    // Get all member records
    all = () => {
        if (!fs.existsSync(this.members_file)) return [];
        return JSON.parse(fs.readFileSync(this.members_file, "utf8"));
    };

    // Find member by ID
    findById = (id) => {
        return this.all().find(m => m.id === id) || null;
    };

    // Find all members with filters
    findAll = (filters = {}) => {
        let results = this.all();

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            switch (key) {
                case "title":
                case "first_name":
                case "last_name":
                case "occupation":
                case "marital_status":
                case "phone_number":
                case "home_address":
                case "home_address_post_code":
                    results = results.filter(m => m[key]?.toLowerCase() === value.toLowerCase());
                    break;

                case "date_of_birth":
                    if (typeof value === "string") {
                        results = results.filter(m => m.date_of_birth === value);
                    } else if (value.from || value.to) {
                        const from = value.from ? new Date(value.from) : null;
                        const to   = value.to ? new Date(value.to) : null;
                        results = results.filter(m => {
                            const dob = new Date(m.date_of_birth);
                            if (isNaN(dob)) return false;
                            return (!from || dob >= from) && (!to || dob <= to);
                        });
                    }
                    break;

                case "is_born_again":
                    results = results.filter(m => m.is_born_again === Boolean(value));
                    break;

                case "is_a_worker":
                    results = results.filter(m => m.is_a_worker === Boolean(value));
                    break;

                case "service_unit":
                    results = results.filter(m => m.service_units?.some(u => u.toLowerCase() === value.toLowerCase()));
                    break;
                case "emails_in":
                    results = results.filter(m => value.includes(m.email_address.toLowerCase()));
                    break;
            }
        });

        return results;
    };
}

module.exports = MemberManager;
