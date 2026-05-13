import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["shared/**/*.test.ts", "apps/vue/src/**/*.test.ts"],
  },
});
