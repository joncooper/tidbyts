import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(
            new URL("./migrations", import.meta.url).pathname,
          ),
          READ_TOKEN: "read-test-token",
          INGEST_TOKEN: "ingest-test-token",
          HOUSEHOLD_TOKEN: "household-test-token",
          GITHUB_REPOSITORY: "joncooper/tidbyts",
        },
      },
    })),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
