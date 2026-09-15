const express = require('express');
const app = express();
app.get('/test', (req, res) => { throw new Error('Test'); });
app.listen(3001);
