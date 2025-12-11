/**
 * Prompt for summarizing a single content item
 */

export const SUMMARIZE_SYSTEM_PROMPT = `You are a content summarization assistant. Your task is to create concise, informative summaries of articles and web content.

Guidelines:
- Extract the key points and main ideas
- Keep the summary concise (2-4 paragraphs)
- Preserve important facts, numbers, and quotes
- Use clear, professional language
- Write in the same language as the original content
- Focus on actionable insights when applicable`;

export function buildSummarizeUserPrompt(title: string, content: string): string {
  return `Please summarize the following article.

Title: ${title}

Content:
${content}

Provide a concise summary that captures the main points and key insights.`;
}
