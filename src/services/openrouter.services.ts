export class OpenRouterCreditLimitError extends Error {
  constructor(message = "OpenRouter credit limit reached.") {
    super(message);
    this.name = "OpenRouterCreditLimitError";
  }
}

export async function promptOpenRouter(prompt: string): Promise<string | void> {
    try {
        console.log("Prompting OpenRouter...");
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-20b:free',
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data?.error?.message || data?.message || "OpenRouter request failed.";
            const normalizedMessage = errorMessage.toLowerCase();

            if (response.status === 402 || response.status === 429 || normalizedMessage.includes("credit") || normalizedMessage.includes("limit") || normalizedMessage.includes("quota") || normalizedMessage.includes("insufficient")) {
                throw new OpenRouterCreditLimitError(errorMessage);
            }

            throw new Error(errorMessage);
        }

        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== "string") {
            throw new Error("OpenRouter returned an unexpected response format.");
        }

        return text;
    } catch (error) {
        console.error('OpenRouter error:', error);
        throw error;
    }
}

