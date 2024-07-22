import "jquery";
import { Crawler } from "./common/crawler";
import { ToolRequest } from "./common/types";
import { getSecretValue } from "./common/secrets";
import { braveSearch } from "./common/search";

/*
{
  "BRAVE_API_KEY": ""
}
*/

export async function handler(event: ToolRequest) {
  console.log("Event", event);

  try {
    const request_urls = event.input.urls ?? [];
    const urls = Array.isArray(request_urls) ? request_urls : [request_urls];

    let ret_text = "";
    if (event.input.query) {
      const secret = await getSecretValue();
      const braveApiKey = secret?.BRAVE_API_KEY ?? "";
      const searchResults = await braveSearch(braveApiKey, event.input.query);
      const topResults = searchResults.slice(0, 1);
      urls.push(...topResults.map((result: { url: string }) => result.url));

      for (const result of topResults) {
        ret_text += `URL: ${result.url}\n`;

        if (result.title) {
          ret_text += `Title: ${result.title}\n`;
        }

        if (result.description) {
          ret_text += `Description: ${result.description}\n\n`;
        }
      }
    }

    const crawler = new Crawler();
    const response = await crawler.process(urls);

    for (const current of response) {
      const content = current.markdown_content;
      const description = current?.meta?.description;
      const title = current?.meta?.title;

      ret_text += `URL: ${current.url}\n`;
      if (title) {
        ret_text += `Title: ${title}\n`;
      }

      if (description) {
        ret_text += `Description: ${current?.meta?.description}\n`;
      }

      ret_text += `Content:\n${content}\n\n`;
    }

    return {
      status: "success",
      content: {
        text: ret_text,
      },
    };
  } catch (error: unknown) {
    return {
      status: "error",
      content: {
        text: JSON.stringify(error),
      },
    };
  }
}
