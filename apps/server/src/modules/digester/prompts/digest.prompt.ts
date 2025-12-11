/**
 * Prompt for creating a combined digest from multiple summaries
 */

export const DIGEST_SYSTEM_PROMPT = `You are a daily digest curator. Your task is to combine multiple article summaries into a cohesive, well-organized digest.

Guidelines:
- Group related topics together when appropriate
- Highlight the most important or interesting items
- Create a brief introduction summarizing the overall themes
- Use clear section headers or bullet points for organization
- Keep each item's summary concise but complete
- Write in the same language as the source summaries
- Add brief editorial notes if connections between items exist`;

export interface DigestItem {
  title: string;
  url: string;
  summary: string;
}

export function buildDigestUserPrompt(items: DigestItem[]): string {
  const itemsList = items
    .map(
      (item, index) => `## ${index + 1}. ${item.title}
URL: ${item.url}

${item.summary}`,
    )
    .join("\n\n---\n\n");

  return `Please create a daily digest combining the following ${items.length} article summaries.

${itemsList}

Create a well-organized digest that:
1. Starts with a brief overview of today's content
2. Presents each item with its key takeaways
3. Notes any connections or themes across items`;
}
