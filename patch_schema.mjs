import fs from 'fs';
let schema = fs.readFileSync('src/db/schema.ts', 'utf-8');

// Add resetToken and resetTokenExpiry to users table
schema = schema.replace(
  "passwordHash: text('password_hash'),",
  "passwordHash: text('password_hash'),\n  resetToken: text('reset_token'),\n  resetTokenExpiry: timestamp('reset_token_expiry'),"
);

fs.writeFileSync('src/db/schema.ts', schema);
console.log('Updated schema.ts');
