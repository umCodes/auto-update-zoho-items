export function stripJsonCodeBlock(text: string): string {
  return text
    .replace(/^```json\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

