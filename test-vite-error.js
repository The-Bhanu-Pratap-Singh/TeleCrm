const { createServer } = require('vite');
async function run() {
  const vite = await createServer({ server: { middlewareMode: true } });
  // simulate an error page
}
run();
