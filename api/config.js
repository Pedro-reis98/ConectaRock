module.exports = function handler(_req, res) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(`window.CONECTA_ROCK_CONFIG = ${JSON.stringify({
    socketUrl: process.env.SOCKET_URL || '',
  })};`);
};
