const express = require('express');
const app = express();
app.get('/crash', (req, res) => { throw new Error('Boom'); });
app.listen(3001, () => console.log('started'));
