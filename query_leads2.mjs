import { db } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';

async function run() {
  const users = await db.select().from(schema.users);
  console.log("Users:", users);
  
  const leads = await db.select().from(schema.leads);
  console.log("Lead assignment counts:");
  let counts = {};
  for(let l of leads) {
     counts[l.assignedUserId] = (counts[l.assignedUserId] || 0) + 1;
  }
  console.log(counts);
  process.exit(0);
}
run().catch(console.error);
