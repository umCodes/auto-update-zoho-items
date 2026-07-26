import { config } from "dotenv";
import { refreshZohoAccessToken } from "./middlewares/zoho.middleware.js";
import { editAndUpdateItems, pushDailyEInvoices } from "./utils/zoho.js";
import { createLogger } from "./utils/logger.js";

config();

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
        await pushDailyEInvoices(authToken)
        await editAndUpdateItems(authToken);
        logger.success("Daily Zoho item update run completed.");
        return
    } catch (error) {
        logger.error("Daily Zoho item update run failed:", error);
    } finally {
        isDailyRunInProgress = false;
    }
}

await runDailyUpdate();



