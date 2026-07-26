import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { itemEditPrompt } from "../prompts/itemEdit.prompt.js";
import { getItem, getItems, getInvoices, pushEInvoice, updateItem } from "../services/zoho.services.js";
import { OpenRouterCreditLimitError, promptOpenRouter } from "../services/openrouter.services.js";
import { Item } from "../types/zoho.js";
import { createLogger } from "./logger.js";
import { stripJsonCodeBlock } from "./json.js";

const logger = createLogger("zoho-jobs");
const STATE_FILE_PATH = path.join(process.cwd(), "data", "item-processing-state.json");
const DAILY_LIMIT = 40;

type ProcessStateEntry = {
  item_id: string;
  last_processed_at?: string;
  status: "pending" | "done" | "failed" | "skipped";
  attempts: number;
  last_error?: string;
};

type ProcessState = {
  last_run_at?: string;
  paused_until?: string;
  pause_reason?: string;
  entries: Record<string, ProcessStateEntry>;
};

function ensureStateFile(): ProcessState {
  const dir = path.dirname(STATE_FILE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(STATE_FILE_PATH)) {
    const initialState: ProcessState = { entries: {} };
    writeFileSync(STATE_FILE_PATH, JSON.stringify(initialState, null, 2));
    logger.info("Initialized item processing state file.");
    return initialState;
  }

  return JSON.parse(readFileSync(STATE_FILE_PATH, "utf-8")) as ProcessState;
}

function saveState(state: ProcessState) {
  writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
  logger.debug(`Saved processing state with ${Object.keys(state.entries).length} tracked items.`);
}

function getItemState(state: ProcessState, itemId: string): ProcessStateEntry {
  return state.entries[itemId] ?? { item_id: itemId, status: "pending", attempts: 0 };
}

function updateItemState(state: ProcessState, itemId: string, patch: Partial<ProcessStateEntry>) {
  state.entries[itemId] = {
    ...getItemState(state, itemId),
    ...patch,
    item_id: itemId,
  };
}

export function addDefaultTaxFields<T extends Record<string, any>>(obj: T): T {
  return Object.assign(obj, {
    tax_id: "46324000000043661",
    tax_name: "Standard Rate",
    tax_percentage: 15,
    tax_type: "tax",
    tax_status: "Active",
    tax_country_code: "SA",
    is_taxable: true,
  });
}


export async function itemEdit(item: {name: string, description: string}): Promise<Item>  {

        const response = await promptOpenRouter(itemEditPrompt(JSON.stringify(item, null, 2)))
        if (typeof response !== "string" ) throw new Error("Something went wrong promptingOpenRouter.")    
        const itemData = JSON.parse(stripJsonCodeBlock(response))
        addDefaultTaxFields(itemData)

        return itemData

}

export async function editAndUpdateItems(
  authToken: string,
  items: Array<{ item_id: string | number; description?: string }> = [],
  limit = DAILY_LIMIT
) {
  const state = ensureStateFile();
  const updatedItems: Array<Record<string, unknown>> = [];
  let processed = 0;
  let page = 1;
  let allItems: Array<{ item_id: string | number; description?: string }> = [...items];

  const now = new Date();
  state.last_run_at = now.toISOString();

  if (state.paused_until && new Date(state.paused_until) > now) {
    logger.warn(`Daily processing is paused until ${state.paused_until} because: ${state.pause_reason || "OpenRouter credit limit reached."}`);
    saveState(state);
    return { updatedItems, processed, state, paused: true };
  }

  if (state.paused_until && new Date(state.paused_until) <= now) {
    delete state.paused_until;
    delete state.pause_reason;
  }

  saveState(state);
  logger.info(`Starting daily item processing run. Daily limit: ${limit}.`);

  while (processed < limit) {
    logger.info(`Fetching Zoho items page ${page}.`);
    const pageResponse = await getItems(authToken, page);
    const pageItems = (pageResponse.items ?? []) as Array<{ item_id: string | number; description?: string }>;

    if (!pageItems.length) {
      logger.warn(`No more items found on page ${page}; stopping pagination.`);
      break;
    }

    allItems = [...allItems, ...pageItems];

    for (const [index, item] of pageItems.entries()) {
      const itemId = String(item.item_id);
      const currentState = getItemState(state, itemId);

      if (processed >= limit) {
        break;
      }

      if (item.description) {
        logger.info(`Skipping item ${itemId}: description already present.`);
        continue;
      }

      if (currentState.status === "done" && currentState.last_processed_at) {
        logger.warn(`Retrying item ${itemId}: prior success is being rechecked during the daily pass.`);
      }

      logger.info(`Processing item ${index + 1}/${pageItems.length} on page ${page} (${itemId})`);

      try {
        const itemData = await getItem(authToken, itemId);
        logger.success(`Fetched item details for ${itemId}`);

        const newItem = await itemEdit({
          name: itemData.name,
          description: itemData.description,
        });
        logger.success(`Generated revised content for ${itemId}`);

        const previousName = itemData.name ?? "Unnamed";
        const updatedDescription = newItem.description ?? "";

        const updatedItem = await updateItem(authToken, itemId, newItem);
        logger.success(`Updated item ${itemId}: name="${previousName}" description="${updatedDescription}"`);

        updateItemState(state, itemId, {
          status: "done",
          last_processed_at: new Date().toISOString(),
          attempts: currentState.attempts + 1,
        });
        updatedItems.push(updatedItem);
        processed += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        if (error instanceof OpenRouterCreditLimitError) {
          const nextDay = new Date();
          nextDay.setDate(nextDay.getDate() + 1);
          nextDay.setHours(0, 0, 0, 0);

          state.paused_until = nextDay.toISOString();
          state.pause_reason = errorMessage;
          saveState(state);
          logger.error(`OpenRouter credit limit reached. Pausing daily processing until ${state.paused_until}.`);
          return { updatedItems, processed, state, paused: true };
        }

        logger.error(`Item processing failed for ${itemId}: ${errorMessage}`);

        updateItemState(state, itemId, {
          status: "failed",
          attempts: currentState.attempts + 1,
          last_error: errorMessage,
        });
      }
    }

    const pageContext = pageResponse.page_context;
    if (!pageContext?.has_more_page) {
      logger.info(`Completed Zoho pagination at page ${page}.`);
      break;
    }

    page += 1;
  }

  saveState(state);
  logger.success(`Daily item processing run finished. Updated ${processed} items.`);

  return { updatedItems, processed, state, paused: false };
}



function getDateDaysBefore(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function pushDailyEInvoices(authToken: string) {
  const startDate = getDateDaysBefore(3);
  const results: Array<{ invoice_id: string | number; status: "success" | "failed"; error?: string }> = [];
  let page = 1;
  let hasMorePages = true;

  logger.info(`Starting e-invoice push run for invoices from ${startDate} onward.`);

  while (hasMorePages) {
    const response = await getInvoices(authToken, startDate, page);
    const invoices = (response.invoices ?? []) as Array<{ invoice_id: string | number; invoice_number?: string }>;

    if (!invoices.length) {
      logger.warn(`No invoices found on page ${page} for date after ${startDate}.`);
      break;
    }

    for (const invoice of invoices) {
      const invoiceId = String(invoice.invoice_id);

      try {
        await pushEInvoice(authToken, invoiceId);
        logger.success(`Pushed e-invoice ${invoiceId}`);
        results.push({ invoice_id: invoice.invoice_id, status: "success" });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`Failed to push e-invoice ${invoiceId}: ${errorMessage}`);
        results.push({ invoice_id: invoice.invoice_id, status: "failed", error: errorMessage });
      }
    }

    const pageContext = response.page_context;
    hasMorePages = Boolean(pageContext?.has_more_page);
    page += 1;
  }

  logger.success(`Completed e-invoice push run. Processed ${results.length} invoices.`);
  return { startDate, results };
}