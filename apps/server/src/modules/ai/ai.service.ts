import { env } from "@/env";
import { GoogleGenAI } from "@google/genai";
import { Injectable, Logger } from "@nestjs/common";
import {
  EXTRACT_STABLE_SELECTORS_SYSTEM_PROMPT,
  type ExtractStableSelectorsInput,
  buildExtractStableSelectorsPrompt,
  parseStableSelectorsResponse,
} from "./prompts/extract-stable-selectors.prompt";
import {
  FIND_LCA_SYSTEM_PROMPT,
  type FindLCAInput,
  buildFindLCAPrompt,
} from "./prompts/find-lca.prompt";

const DEFAULT_MODEL = "gemini-2.0-flash";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genai: GoogleGenAI;

  constructor() {
    this.genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  /**
   * Find the Lowest Common Ancestor (LCA) selector for given URLs
   */
  async findLCA(input: FindLCAInput): Promise<string | null> {
    this.logger.log(`Finding LCA for ${input.targetUrls.length} URLs`);

    try {
      const response = await this.genai.models.generateContent({
        model: DEFAULT_MODEL,
        config: {
          maxOutputTokens: 256,
          systemInstruction: FIND_LCA_SYSTEM_PROMPT,
        },
        contents: buildFindLCAPrompt(input),
      });

      const selector = response.text?.trim() ?? "";
      this.logger.log(`LCA found: ${selector}`);

      // Basic validation - should look like a CSS selector
      if (
        selector &&
        (selector.includes(".") || selector.includes("#") || /^[a-z]+$/i.test(selector))
      ) {
        return selector;
      }

      this.logger.warn(`Invalid LCA selector: ${selector}`);
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to find LCA: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  }

  /**
   * Extract stable CSS selectors from DOM structure
   */
  async extractStableSelectors(input: ExtractStableSelectorsInput): Promise<string[]> {
    this.logger.log(`Extracting stable selectors for: ${input.currentSelector}`);

    try {
      const response = await this.genai.models.generateContent({
        model: DEFAULT_MODEL,
        config: {
          maxOutputTokens: 512,
          systemInstruction: EXTRACT_STABLE_SELECTORS_SYSTEM_PROMPT,
        },
        contents: buildExtractStableSelectorsPrompt(input),
      });

      const result = parseStableSelectorsResponse(response.text ?? "");
      this.logger.log(`Extracted ${result.selectors.length} stable selectors`);

      return result.selectors;
    } catch (error) {
      this.logger.error(
        `Failed to extract stable selectors: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }
}
