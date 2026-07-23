import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
  path: "prisma/migrations",
  seed: "node ./prisma/seed.ts",
},
  // Prisma is moving datasource config here; CLI commands like migrate require it.
  datasource: {
    url: env("DATABASE_URL"),
  },
  // Helpful for Prisma's newer config flow; safe to include.
  engine: "classic",
});

