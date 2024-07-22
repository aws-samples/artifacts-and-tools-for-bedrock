export interface StackConfig {
  bedrockRegion?: string;
  bedrockModel: string;
  playground?: {
    enabled: boolean;
  };
  artifacts?: {
    enabled: boolean;
  };
  codeInterpreterTool?: {
    enabled: boolean;
  };
  webSearchTool?: {
    enabled: boolean;
  };
}
