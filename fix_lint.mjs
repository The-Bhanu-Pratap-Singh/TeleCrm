import fs from 'fs';
let main = fs.readFileSync('src/main.tsx', 'utf-8');

main = main.replace(
  "const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;",
  "const url = typeof args[0] === 'string' ? args[0] : ('url' in args[0] ? args[0].url : args[0].href);"
);

// wait actually args[0] is `string | URL | Request`
main = main.replace(
  "const url = typeof args[0] === 'string' ? args[0] : ('url' in args[0] ? args[0].url : args[0].href);",
  "const url = typeof args[0] === 'string' ? args[0] : ('url' in (args[0] as any) ? (args[0] as any).url : (args[0] as any).href);"
);


fs.writeFileSync('src/main.tsx', main);
console.log('Fixed lint');
