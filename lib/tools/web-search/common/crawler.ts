import aws_chromium from "@sparticuz/chromium";
import { Page } from "playwright";
import { JSDOM } from "jsdom";
import {
  Configuration,
  PlaywrightCrawler,
  PlaywrightCrawlingContext,
} from "crawlee";
import { Readability } from "@mozilla/readability";
import { PageMetadata } from "./types";
import { gfm } from "turndown-plugin-gfm";
import TurndownService from "turndown";

const turndownService = new TurndownService();
turndownService.use(gfm);

export class Crawler {
  async process(urls?: string[]) {
    urls = urls?.map((url) => url.trim()) ?? [];

    const crawler = await this.create_crawler();

    await crawler.run(urls);

    const data = await crawler.getData();
    const items = data["items"];

    return items;
  }

  private async create_crawler() {
    const crawler = new PlaywrightCrawler(
      {
        launchContext: {
          launchOptions: {
            executablePath: await aws_chromium.executablePath(),
            args: aws_chromium.args,
            headless: true,
          },
        },
        maxRequestsPerCrawl: 25,
        maxRequestRetries: 5,
        preNavigationHooks: [
          async (crawlingContext, gotoOptions) => {
            if (gotoOptions && crawlingContext.request.retryCount >= 2) {
              gotoOptions.waitUntil = "domcontentloaded";
            }
          },
        ],
        requestHandler: async (context: PlaywrightCrawlingContext) => {
          try {
            await this.requestHandler(context);
          } catch (e) {
            console.error(e);
          }
        },
        failedRequestHandler: async (ctx: PlaywrightCrawlingContext) => {
          console.error(`Failed to load page: ${ctx.request.errorMessages}`, {
            url: ctx.request.url,
          });
        },
      },
      new Configuration({
        persistStorage: false,
      })
    );

    return crawler;
  }

  private async requestHandler(ctx: PlaywrightCrawlingContext) {
    const contentType = await this.getContentType(ctx.response);
    if (contentType !== "text/html") {
      console.log("Content type", contentType);
      return;
    }

    const status = ctx.response?.status();
    if (status !== 200) {
      console.log("Status", status);
      return;
    }

    const meta = await this.getPageMetadata(ctx.page);
    console.log(`${meta.title}`, { url: ctx.request.loadedUrl });
    await this.deleteTags(ctx.page, [
      "script",
      "style",
      "link",
      "iframe",
      "header",
      "footer",
      "svg",
      "input",
    ]);

    const page_html = (await (await ctx.page.$("body"))?.innerHTML()) ?? "";
    const page = new JSDOM(page_html, {
      url: ctx.request.loadedUrl,
    });

    const text_content =
      new Readability(page.window.document).parse()?.textContent ?? "";
    const markdown_content = turndownService.turndown(page_html);

    const item = {
      success: true,
      content_type: contentType,
      url: ctx.request.url,
      meta,
      text_content,
      markdown_content,
      html_content: page_html,
    };

    await ctx.pushData(item);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getContentType(response: any | undefined) {
    const contentType = await response?.headerValue("content-type");

    if (contentType) {
      return contentType.split(";")[0].trim();
    }

    return "text/html";
  }

  private async getPageMetadata(page: Page): Promise<PageMetadata> {
    const title = await page.title();

    const getMetaContent = async (tag: string, property = "name") => {
      const metaTag = await page.$(`meta[${property}='${tag}']`);
      return (await metaTag?.getAttribute("content")) ?? undefined;
    };

    const description = await getMetaContent("description");
    const keywords = await getMetaContent("keywords");
    const author = await getMetaContent("author");

    return {
      title,
      description,
      keywords,
      author,
    };
  }

  private async deleteTags(page: Page, tags: string[]) {
    for (const tag of tags) {
      for (const element of await page.$$(tag)) {
        await element.evaluate((e) => e.remove());
      }
    }
  }
}
