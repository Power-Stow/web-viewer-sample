/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_STREAM_SERVER?: string;
    readonly VITE_STREAM_SIGNALING_PORT?: string;
    readonly VITE_STREAM_MEDIA_PORT?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
