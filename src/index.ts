import express from "express";
import { config } from "dotenv";
import { refreshZohoAccessToken } from "./middlewares/zoho.middleware.js";
import { editAndUpdateItems } from "./utils/zoho.js";
import { createLogger } from "./utils/logger.js";

config();

const PORT = process.env.PORT || 3000;
const app = express();
const logger = createLogger("app");

let isDailyRunInProgress = false;

async function runDailyUpdate() {
    if (isDailyRunInProgress) {
        logger.warn("A daily update is already running. Skipping duplicate run.");
        return;
    }

    isDailyRunInProgress = true;
    logger.info("Starting scheduled daily Zoho item update run.");

    try {
        const authToken = await refreshZohoAccessToken();
        await editAndUpdateItems(authToken);
        logger.success("Daily Zoho item update run completed.");
    } catch (error) {
        logger.error("Daily Zoho item update run failed:", error);
    } finally {
        isDailyRunInProgress = false;
    }
}

app.get("/", async (_req, res) => {
    res.json({ status: "running", nextRun: "every 24 hours" });
});

app.listen(PORT, () => {
    logger.success(`Server is running on port ${PORT}`);
    void runDailyUpdate();
    setInterval(() => {
        void runDailyUpdate();
    }, 24 * 60 * 60 * 1000);
});


