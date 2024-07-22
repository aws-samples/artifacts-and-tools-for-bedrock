declare global {
  interface Window {
    ________intl_require________: (module: string, name: string) => void;
  }
}

// This ensures the file is treated as a module
export {};
