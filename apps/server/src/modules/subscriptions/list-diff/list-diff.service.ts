import { Injectable, Logger } from "@nestjs/common";
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { ListDiffOptions, ListDiffResult, UrlLookupResult } from "./list-diff.types";

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_DEPTH = 5;

/** Minimum links in container to consider it valid */
const MIN_LINKS_FOR_CONTAINER = 2;

/** Max depth to climb when finding container with multiple links */
const MAX_CLIMB_DEPTH = 10;

@Injectable()
export class ListDiffService {
  private readonly logger = new Logger(ListDiffService.name);

  /**
   * Fetch HTML and extract URLs from a container using a CSS selector
   */
  async fetch(
    pageUrl: string,
    selector: string,
    options: ListDiffOptions = {},
  ): Promise<ListDiffResult> {
    const startTime = Date.now();
    const { timeout = DEFAULT_TIMEOUT, maxDepth = DEFAULT_MAX_DEPTH } = options;

    this.logger.debug(`Fetching ${pageUrl} with selector: ${selector}`);

    try {
      const html = await this.fetchHtml(pageUrl, timeout);
      const $ = cheerio.load(html);

      // Find the container using the provided selector
      const container = $(selector).first();

      if (container.length === 0) {
        this.logger.warn(`Selector not found: ${selector} on ${pageUrl}`);
        return {
          success: false,
          urls: [],
          selectorHierarchy: "",
          error: `Selector not found: ${selector}`,
          durationMs: Date.now() - startTime,
        };
      }

      // Extract all URLs from <a> tags within the container
      const urls = this.extractUrls($, container, pageUrl);

      if (urls.length === 0) {
        this.logger.warn(`No URLs found in container ${selector} on ${pageUrl}`);
        return {
          success: false,
          urls: [],
          selectorHierarchy: "",
          error: "No URLs found in the selected container",
          durationMs: Date.now() - startTime,
        };
      }

      // Generate simplified DOM hierarchy for AI analysis
      const selectorHierarchy = this.generateSelectorHierarchy($, container, maxDepth);

      this.logger.debug(
        `Extracted ${urls.length} URLs from ${pageUrl} in ${Date.now() - startTime}ms`,
      );

      return {
        success: true,
        urls,
        selectorHierarchy,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch ${pageUrl}: ${errorMsg}`);
      return {
        success: false,
        urls: [],
        selectorHierarchy: "",
        error: errorMsg,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Look up known URLs in the page to find the container
   * Used for URL reverse-lookup strategy
   */
  async lookupUrlsInPage(
    pageUrl: string,
    knownUrls: string[],
    options: ListDiffOptions = {},
  ): Promise<UrlLookupResult> {
    const { timeout = DEFAULT_TIMEOUT } = options;

    this.logger.debug(`Looking up ${knownUrls.length} URLs in ${pageUrl}`);

    try {
      const html = await this.fetchHtml(pageUrl, timeout);
      const $ = cheerio.load(html);

      // Build a Map of normalized URLs to elements (O(m) - single pass)
      const hrefToElement = new Map<string, cheerio.Cheerio<Element>>();
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        const normalizedHref = this.normalizeUrl(href, pageUrl);
        // Keep first occurrence only
        if (!hrefToElement.has(normalizedHref)) {
          hrefToElement.set(normalizedHref, $(el));
        }
      });

      // Find matching URLs (O(n) lookup)
      const foundElements: cheerio.Cheerio<Element>[] = [];
      const foundUrls: string[] = [];

      for (const knownUrl of knownUrls) {
        const normalizedKnownUrl = this.normalizeUrl(knownUrl, pageUrl);
        const element = hrefToElement.get(normalizedKnownUrl);

        if (element && !foundUrls.includes(normalizedKnownUrl)) {
          foundElements.push(element);
          foundUrls.push(normalizedKnownUrl);
        }
      }

      if (foundElements.length === 0) {
        this.logger.debug(`No matching URLs found in ${pageUrl}`);
        return { found: false, foundUrls: [] };
      }

      // Find the Lowest Common Ancestor (LCA) of all found elements
      const containerSelector = this.findLCA($, foundElements);

      // Extract URLs and hierarchy from the container (avoids duplicate fetch)
      let containerUrls: string[] = [];
      let selectorHierarchy = "";

      if (containerSelector) {
        const container = $(containerSelector).first();
        if (container.length > 0) {
          containerUrls = this.extractUrls($, container, pageUrl);
          selectorHierarchy = this.generateSelectorHierarchy($, container, DEFAULT_MAX_DEPTH);
        }
      }

      this.logger.debug(
        `Found LCA container: ${containerSelector} with ${containerUrls.length} URLs (matched ${foundUrls.length}/${knownUrls.length})`,
      );

      return {
        found: true,
        foundUrls,
        containerSelector,
        containerUrls,
        selectorHierarchy,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`URL lookup failed for ${pageUrl}: ${errorMsg}`);
      return { found: false, foundUrls: [] };
    }
  }

  /**
   * Compare two URL arrays and find new URLs
   */
  diffUrls(previousUrls: string[], currentUrls: string[]): string[] {
    const previousSet = new Set(previousUrls);
    return currentUrls.filter((url) => !previousSet.has(url));
  }

  /**
   * Extract all URLs from anchor tags within a container
   */
  private extractUrls(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<AnyNode>,
    baseUrl: string,
  ): string[] {
    const urls: string[] = [];
    const seen = new Set<string>();

    container.find("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      // Skip anchors, javascript links, and empty hrefs
      if (href.startsWith("#") || href.startsWith("javascript:") || href === "") return;

      const normalizedUrl = this.normalizeUrl(href, baseUrl);

      // Skip duplicates
      if (seen.has(normalizedUrl)) return;
      seen.add(normalizedUrl);

      urls.push(normalizedUrl);
    });

    return urls;
  }

  /**
   * Generate a simplified DOM hierarchy for AI analysis
   */
  private generateSelectorHierarchy(
    $: cheerio.CheerioAPI,
    container: cheerio.Cheerio<AnyNode>,
    maxDepth: number,
  ): string {
    const processNode = (node: cheerio.Cheerio<AnyNode>, depth: number): string => {
      if (depth > maxDepth) return "";

      const element = node.get(0);
      if (!element || element.type !== "tag") return "";

      const tagName = element.tagName;
      const classes = this.cleanClasses(node.attr("class") || "");
      const id = node.attr("id");
      const href = tagName === "a" ? node.attr("href") : null;

      // Build opening tag
      let tag = `<${tagName}`;
      if (id) tag += ` id="${id}"`;
      if (classes) tag += ` class="${classes}"`;
      if (href) tag += ` href="${this.truncate(href, 50)}"`;
      tag += ">";

      // For links, add text content (truncated)
      if (tagName === "a") {
        const text = node.text().trim();
        if (text) {
          tag += this.truncate(text, 30);
        }
      }

      // Process children
      const children = node.children();
      if (children.length > 0) {
        const childStrings: string[] = [];
        children.each((_, child) => {
          const childHtml = processNode($(child), depth + 1);
          if (childHtml) childStrings.push(childHtml);
        });
        tag += childStrings.join("");
      }

      tag += `</${tagName}>`;
      return tag;
    };

    return processNode(container, 0);
  }

  /**
   * Find the Lowest Common Ancestor selector for multiple elements
   */
  private findLCA($: cheerio.CheerioAPI, elements: cheerio.Cheerio<Element>[]): string | undefined {
    if (elements.length === 0) return undefined;

    // Single element: climb up to find a container with multiple <a> tags
    if (elements.length === 1) {
      return this.findContainerWithMultipleLinks($, elements[0]);
    }

    // Get parent chains for all elements
    const parentChains = elements.map((el) => {
      const chain: cheerio.Cheerio<Element>[] = [];
      let current = el;
      while (current.length > 0) {
        chain.unshift(current);
        current = current.parent() as cheerio.Cheerio<Element>;
        // Stop at body
        if (current.is("body") || current.is("html")) break;
      }
      return chain;
    });

    // Find the deepest common ancestor
    let lcaIndex = 0;
    const minLength = Math.min(...parentChains.map((c) => c.length));

    for (let i = 0; i < minLength; i++) {
      const firstElement = parentChains[0][i];
      const allSame = parentChains.every((chain) => chain[i].is(firstElement));
      if (allSame) {
        lcaIndex = i;
      } else {
        break;
      }
    }

    const lca = parentChains[0][lcaIndex];
    return this.getElementSelector($, lca);
  }

  /**
   * Find a parent container that has multiple <a> tags
   * Used when only one URL is found to climb up and find a proper list container
   */
  private findContainerWithMultipleLinks(
    $: cheerio.CheerioAPI,
    element: cheerio.Cheerio<Element>,
  ): string | undefined {
    let current = element.parent() as cheerio.Cheerio<Element>;
    let depth = 0;

    while (current.length > 0 && depth < MAX_CLIMB_DEPTH) {
      // Stop at body/html
      if (current.is("body") || current.is("html")) break;

      // Count <a> tags in this container
      const linkCount = current.find("a[href]").length;

      // Found a container with enough links to be a list
      if (linkCount >= MIN_LINKS_FOR_CONTAINER) {
        return this.getElementSelector($, current);
      }

      current = current.parent() as cheerio.Cheerio<Element>;
      depth++;
    }

    // Fallback: return the original element's selector
    return this.getElementSelector($, element);
  }

  /**
   * Generate a CSS selector for an element
   */
  private getElementSelector($: cheerio.CheerioAPI, element: cheerio.Cheerio<Element>): string {
    const el = element.get(0);
    if (!el || el.type !== "tag") return "";

    const tagName = el.tagName;
    const id = element.attr("id");
    const classes = this.cleanClasses(element.attr("class") || "");

    if (id) return `#${id}`;
    if (classes) return `${tagName}.${classes.split(" ").join(".")}`;
    return tagName;
  }

  /**
   * Remove hash-like class names (e.g., sc-abc123, _1a2b3c)
   */
  private cleanClasses(classStr: string): string {
    return classStr
      .split(/\s+/)
      .filter((cls) => {
        // Skip empty strings
        if (!cls) return false;
        // Skip hash-like classes (common in CSS-in-JS)
        if (/^[_-]?[a-z]{1,3}[a-zA-Z0-9]{5,}$/.test(cls)) return false;
        if (/^css-[a-zA-Z0-9]+$/.test(cls)) return false;
        if (/^sc-[a-zA-Z0-9]+$/.test(cls)) return false;
        return true;
      })
      .join(" ");
  }

  /**
   * Normalize URL (resolve relative URLs)
   */
  private normalizeUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return href;
    }
  }

  /**
   * Truncate string to max length
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return `${str.substring(0, maxLength)}...`;
  }

  /**
   * Fetch raw HTML from a URL
   */
  private async fetchHtml(url: string, timeout: number): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
