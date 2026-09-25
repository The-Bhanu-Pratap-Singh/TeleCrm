import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const sqlHost = process.env.MYSQL_HOST || process.env.SQL_HOST || "localhost";
const sqlDbName = process.env.MYSQL_DATABASE || process.env.SQL_DB_NAME || "cloud_sql_development_database";
const user = process.env.MYSQL_USER || process.env.SQL_USER || process.env.SQL_ADMIN_USER || "root";
const password = process.env.MYSQL_PASSWORD || process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || "";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: sqlHost,
    user: user,
    password: password,
    database: sqlDbName,
  },
  verbose: true,
});
