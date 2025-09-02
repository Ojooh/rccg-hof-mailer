const fs = require("fs");
const lockfile = require("proper-lockfile");

class LockedFileUtil {
    constructor(logger = null) {
        this.logger = logger; // optional LoggerUtil instance
    }

    /**
     * Safely read JSON data from a locked file
     * @param {string} filePath - Path to the file
     * @returns {Promise<any[]>} - Parsed JSON array
     */
    readJson = async (filePath) => {
        let release;
        try {
            release = await lockfile.lock(filePath, {
                retries: { retries: 5, factor: 2, minTimeout: 100, maxTimeout: 2000 },
                stale: 5000
            });
            if (this.logger) this.logger.info(`Acquired lock for reading ${filePath}`);

            if (!fs.existsSync(filePath)) return [];

            const rawData = fs.readFileSync(filePath, "utf8");
            return JSON.parse(rawData);

        } catch (error) {
            if (this.logger) this.logger.error(`Failed to read locked file ${filePath}`, { error });
            throw error;
        } finally {
            if (release) {
                await release();
                if (this.logger) this.logger.info(`Released lock for reading ${filePath}`);
            }
        }
    }

    /**
     * Safely update a JSON file with new data based on "id" field
     * @param {string} filePath - Path to the file
     * @param {Array<Object>} updatedRows - Array of objects to merge into the file
     */
    updateJson = async (filePath, updatedRows = []) => {
        if (!Array.isArray(updatedRows)) {
            throw new Error("updatedRows must be an array");
        }

        let release;
        try {
            release = await lockfile.lock(filePath, {
                retries: { retries: 5, factor: 2, minTimeout: 100, maxTimeout: 2000 },
                stale: 5000
            });
            if (this.logger) this.logger.info(`Acquired lock for updating ${filePath}`);

            // Load current data
            let currentData = [];
            if (fs.existsSync(filePath)) {
                const rawData = fs.readFileSync(filePath, "utf8");
                currentData = JSON.parse(rawData);
            }

            // Merge/update based on id
            const currentMap = new Map(currentData.map(item => [item.id, item]));
            for (const row of updatedRows) {
                if (!row.id) continue; // skip rows without id
                currentMap.set(row.id, { ...currentMap.get(row.id), ...row });
            }

            const mergedData = Array.from(currentMap.values());

            fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2));
            if (this.logger) this.logger.success(`Updated file ${filePath} successfully`);

        } catch (error) {
            if (this.logger) this.logger.error(`Failed to update locked file ${filePath}`, { error });
            throw error;
        } finally {
            if (release) {
                await release();
                if (this.logger) this.logger.info(`Released lock for updating ${filePath}`);
            }
        }
    }
}

module.exports = LockedFileUtil;
