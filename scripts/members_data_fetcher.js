const axios         = require("axios");
const csv           = require("csv-parser");
const { Readable }  = require("stream");
const fs            = require("fs");
const path          = require("path");
const LoggerUtil 	= require("../utils/logger_util");
const {
	PUBLIC_MEMBER_DATA_CSV_LINK
} = require("../enums/constants")

class MemberDataFetcher {
    constructor(event_system_instance = null) {
		this.module_name 			= "member_data_fetcher";
        this.csv_url        		= PUBLIC_MEMBER_DATA_CSV_LINK;
        this._id_counter    		= 1;
		this.base_dir 				= process.cwd();
        this.db_dir         		= this._ensureDirExist(path.join(this.base_dir, "local_db"));
        this.db_file_name   		= "hof_member_data.json";

		this.logger 				= new LoggerUtil(this.module_name);
		this.event_system_instance 	= event_system_instance;
    }

	// Method to fetch recent data from google form
    fetchData = async () => {
        this.logger.info(`Fetching CSV data from: ${this.csv_url}`);
        try {
            const response = await axios.get(this.csv_url);
            const rows = [];

            return new Promise((resolve, reject) => {
                Readable.from(response.data)
                    .pipe(csv())
                    .on("data", (row) => rows.push(this._normalizeRow(row)))
                    .on("end", () => {
                        this.logger.success(`Fetched ${rows.length} rows from remote CSV`);
                        resolve(rows);
                    })
                    .on("error", (err) => {
                        this.logger.error("Error while parsing CSV stream", { error: err });
                        reject(err);
                    });
            });
        } catch (error) {
            this.logger.error("Error fetching data from Google Sheets", { error });
            return []
        }
    }

	// Method to save data locally
    saveData = async () => {
        this.logger.info("Starting data synchronization...");
        try {
            const new_rows   = await this.fetchData();
            const file_path  = path.join(this.db_dir, this.db_file_name);

            // Load + build fresh map every time
            const { existing_rows, existing_map } = this._getExistingRows();
            this.logger.info(`Loaded ${existing_rows.length} existing rows from local DB`);

            const updated_data = this._updateLocalDbData(new_rows, existing_map, existing_rows);

            fs.writeFileSync(file_path, JSON.stringify(updated_data, null, 4));

            this.logger.success(`Data successfully updated. Local DB now has ${updated_data.length} records.`, { file_path });
            return true;
        } catch (error) {
            this.logger.error("Failed to save data to local DB", { error });
            return false
        }
    }

	// Private Method to normalize row data
    _normalizeRow = (row) => {
        const normalized = {};
        for (let key in row) {
            if (row.hasOwnProperty(key)) {
                const snake_key = key.trim().toLowerCase()
                    .replace(/\s+/g, "_")
                    .replace(/[^\w]/g, "");
                normalized[snake_key] = row[key] ? row[key].trim() : "";
            }
        }
        this.logger.info("Normalized row", normalized);
        return normalized;
    }

	// Private Method to get row key
    _getRowKey = (row) => {
        const first = (row["first_name"] || "").trim().toLowerCase();
        const last  = (row["last_name"] || "").trim().toLowerCase();
        return `${first}_${last}`;
    }

	// Private Method to ensure directory exist
    _ensureDirExist = (dir) => {
        if (!fs.existsSync(dir)) { 
            fs.mkdirSync(dir, { recursive: true }); 
            this.logger.info(`Created missing directory: ${dir}`);
        }
        return dir;
    }

	// Private Method to return existing member rows
    _getExistingRows = () => {
        try {
            const file_path  = path.join(this.db_dir, this.db_file_name);
            let existing_rows = [];

            if (fs.existsSync(file_path)) {
                existing_rows = JSON.parse(fs.readFileSync(file_path, "utf8"));
                const max_id = existing_rows.reduce((max, row) => Math.max(max, row.id || 0), 0);
                this._id_counter = max_id + 1;
                this.logger.info(`Existing DB found, highest ID = ${max_id}`);
            } else {
                this.logger.alert("No existing DB file found. A new one will be created.");
            }

            const existing_map = new Map();
            existing_rows.forEach((row) => {
                const key = this._getRowKey(row);
                existing_map.set(key, row);
            });

            return { existing_rows, existing_map };
        } catch (error) {
            this.logger.error("Error reading existing DB file", { error });
            return { existing_rows: [], existing_map: new Map() }
        }
    }	

	// Method to update existing data with new row data
    _updateLocalDbData = (new_rows, existing_map, existing_rows) => {
        const merged_rows = [];

        for (const new_row of new_rows) {
            const key = this._getRowKey(new_row);

            if (existing_map.has(key)) {
                const existing_row = existing_map.get(key);
                let updated = false;

                for (const field in new_row) {
                    if (field !== "id" && new_row[field] !== existing_row[field]) {
                        existing_row[field] = new_row[field];
                        updated = true;
                    }
                }

                if (updated) {
                    this.logger.info(`Updated existing record: ${key}`, existing_row);
                } else {
                    this.logger.info(`No changes detected for: ${key}`);
                }

                merged_rows.push(existing_row);
            } else {
                new_row.id = this._id_counter++;
                merged_rows.push(new_row);
                this.logger.success(`New record added with ID ${new_row.id}`, new_row);

				// ✅ Trigger event when new member is registered
                if (this.event_system_instance) {
                    this.event_system_instance.emit("new_member_registered", new_row);
                }
            }
        }

        return merged_rows;
    }
}

module.exports = MemberDataFetcher;


// === Usage Example ===

const EventSystemUtil 		= require("../utils/event_system_util");
const event_system_instance = new EventSystemUtil();

event_system_instance.on("new_member_registered", (member) => {
    console.log("🎉 New member registered:", member.first_name, member.last_name);
});


const fetcher = new MemberDataFetcher(event_system_instance);

(async () => {
    await fetcher.saveData();
})();
