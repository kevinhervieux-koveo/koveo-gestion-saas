/// <reference types="vite/client" />
/// <reference types="../types/browser-apis" />

// Ensure DOM APIs are available in Vite environment
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // Add other env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}