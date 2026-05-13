/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEGAL_CONTACT_EMAIL?: string;
  readonly VITE_LEGAL_JURISDICTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
