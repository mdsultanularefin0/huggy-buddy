import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: {
      entry: "server",
      preset: "node-server",
      output: {
        dir: "{{ rootDir }}/dist",
        serverDir: "{{ output.dir }}/server",
        publicDir: "{{ output.dir }}/public",
      },
    },
  },
});
