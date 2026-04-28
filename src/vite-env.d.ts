/// <reference types="vite/client" />

// Bridge surface — fleshed out across P0-C Tasks 3 & 4 (db / net / session).
// Right now we only declare a placeholder so existing `window.fableglitch`
// access type-checks during the foundation tasks.
interface FableglitchBridge {
  __placeholder: true;
}

declare global {
  interface Window {
    fableglitch: FableglitchBridge;
  }
}

export {};
