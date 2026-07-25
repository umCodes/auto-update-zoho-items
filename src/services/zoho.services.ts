import { Item } from "../types/zoho.js";

type Method = "GET" | "POST" | "PUT";

type ZohoItemsResponse = {
  items?: Array<Record<string, unknown>>;
  page_context?: {
    page?: number;
    has_more_page?: boolean;
    per_page?: number;
  };
};

const ORGANIZATION_ID = process.env.ZOHO_ORGANIZATION_ID || "";

async function zohoApi(endpoint: string, authToken: string, params = {}, method: Method = "GET", body?: unknown) {
  const url = new URL(`https://www.zohoapis.sa/books/v3/${endpoint}`);
  url.searchParams.set("organization_id", ORGANIZATION_ID);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value as string);
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": authToken,
      "Content-Type": "application/json" ,
    },
     body: JSON.stringify(body),
  });

  return response.json();
}


export async function getItems(authToken: string, page = 1) {
  const response = await zohoApi("items", authToken, { page }, "GET");
  return response as ZohoItemsResponse;
}

export async function getItem(authToken: string, itemId: string) {
    const response = await zohoApi(`items/${itemId}`, authToken);
    const item = response.item;
    return {
      item_id: item?.item_id,
      name: item?.name,
      name_sec_lang: item?.name_sec_lang,
      description: item?.description,
      tax_id: item?.tax_id,
      tax_percentage: item?.tax_percentage,
      tax_country_code: item?.tax_country_code,
      is_taxable: item?.is_taxable
    };
}



export async function updateItem(authToken: string, itemId: string, item: Partial<Item>) {
  const response = await zohoApi(`items/${itemId}`, authToken, {}, "PUT", item);
  const updatedItem = response?.item;

  return {
    success: true,
    item_id: updatedItem?.item_id ?? itemId,
  };
}


