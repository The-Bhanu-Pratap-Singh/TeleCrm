const originalJson = Response.prototype.json;
Response.prototype.json = async function () {
  const text = await this.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    if (text.trim().startsWith('<')) {
      return { error: 'HTML error page intercepted' };
    }
    throw err;
  }
};

const res = new Response("<html><head></head></html>");
res.json().then(console.log).catch(console.error);
