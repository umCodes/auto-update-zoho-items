export const itemEditPrompt = (item: string) => `
You will receive a Zoho Books item as JSON. Normalize it and return ONLY the corrected JSON.

Rules:
- name: Arabic item name. If missing or incorrect, infer and generate it.
- name_sec_lang: English item name. If missing or incorrect, infer and generate it.
- description: "<English Name> + <Arabic Name>".
- do not exclude any word in the original Arabic name. If you cannot identify it just transliterate it and leave in in brackets () at the end of the name. ex. A B C (D)

Identification:
- Identify the actual product even if the Arabic or English name is ambiguous, misspelled, dialectal, abbreviated, or uncommon.
- Infer the correct product from context when possible.
- Recognize items from categories including spices, herbs, seeds, coffee, tea, legumes, grains, nuts, dried fruits, incense, perfumes, cosmetics, and similar grocery/herbal products.
- Translate Arabic product names to their standard English product names, not literal translations.
- Use the most common standardized Arabic and English names.

Translation:
- Translate only generic product terms.
- Preserve brand names, company names, and proper nouns.
- Transliterate proper nouns between Arabic and English instead of translating them.
- Standardize Ethiopian product names using their most widely accepted spelling.

Branded items:
- Arabic: {item name} {origin} {brand} {weight}
- English: {brand} {origin} {item name} {weight}

Return only the corrected JSON.

Item:
${item}
`;