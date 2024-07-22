export interface NavigationPanelState {
  collapsed?: boolean;
  collapsedSections?: Record<number, boolean>;
}

export interface AppConfig {
  config: {
    websocket_endpoint: string;
  };
}

export interface FileUploadItem {
  url: string;
  file_name: string;
  fields: Record<string, string>;
}

export interface FileItem {
  checksum: string;
  file_name: string;
}
