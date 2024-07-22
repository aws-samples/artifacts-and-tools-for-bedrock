export interface ToolRequest {
  tool_use_id: string;
  name: string;
  input: {
    query?: string;
    urls?: string[] | string;
  };
}

export interface PageMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
}
