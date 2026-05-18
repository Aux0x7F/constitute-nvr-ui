import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const localUiAdapterLifecycle = fileURLToPath(new URL("../constitute-ui/src/adapter-lifecycle.js", import.meta.url));

export default defineConfig({
  base: "./",
  resolve: {
    preserveSymlinks: true,
    alias: {
      "constitute-ui/adapter-lifecycle": localUiAdapterLifecycle,
    },
  },
});
