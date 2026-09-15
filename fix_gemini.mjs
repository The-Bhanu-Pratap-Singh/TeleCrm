import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const regex = /const model = ai\.getGenerativeModel\([\s\S]*?res\.json\(\{ script: response\.text\(\) \}\);/;
const replacement = `const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      res.json({ script: response.text });`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
console.log('Fixed Gemini API');
