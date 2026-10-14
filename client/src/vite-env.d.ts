/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SIGNALING_SERVER?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_ICE_SERVERS: string;
  readonly VITE_TURN_URL: string;
  readonly VITE_TURN_USERNAME: string;
  readonly VITE_TURN_CREDENTIAL: string;
  readonly VITE_CHUNK_SIZE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
}
