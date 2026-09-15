import fs from 'fs';
let main = fs.readFileSync('src/main.tsx', 'utf-8');

const oldFetch = `const originalFetch = window.fetch;
window.fetch = async function (...args) {`;
const newFetch = `const originalFetch = window.fetch;
try {
  window.fetch = async function (...args) {`;

main = main.replace(oldFetch, newFetch);

const oldFetchEnd = `  return response;
};`;
const newFetchEnd = `  return response;
  };
} catch (e) {
  console.warn('Could not override window.fetch', e);
}`;
main = main.replace(oldFetchEnd, newFetchEnd);

fs.writeFileSync('src/main.tsx', main);
console.log('Fixed fetch override in main.tsx');
