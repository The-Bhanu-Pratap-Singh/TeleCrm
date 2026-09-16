import { db } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';

async function run() {
  const users = await db.select().from(schema.users);
  console.log("Users:", users);
  process.exit(0);
}
run().catch(console.error);
