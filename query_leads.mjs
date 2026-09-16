import { db } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';

async function run() {
  const leads = await db.select().from(schema.leads);
  console.log("Total leads:", leads.length);
  const users = await db.select().from(schema.users);
  console.log("Total users:", users.length);
  process.exit(0);
}
run().catch(console.error);
