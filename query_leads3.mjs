import { db } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';

async function run() {
  const leads = await db.select().from(schema.leads);
  console.log("Lead created ats:", leads.slice(0, 5).map(l => l.createdAt));
  process.exit(0);
}
run().catch(console.error);
