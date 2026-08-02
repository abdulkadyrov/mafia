import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/core/game/{nightResolution,phaseMachine,voting,winCondition}.ts",
        "src/core/roles/{roleAssignment,roleRegistry}.ts",
        "src/core/chat/chatPermissions.ts",
        "src/core/video/audioPermissions.ts",
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
