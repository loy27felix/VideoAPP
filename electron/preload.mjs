import { contextBridge } from 'electron';

// Placeholder bridge — fleshed out in P0-C Tasks 3 & 4 (db / net / session).
contextBridge.exposeInMainWorld('fableglitch', {
  __placeholder: true,
});
