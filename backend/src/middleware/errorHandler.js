export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.code === 'P2002') {
    return res.status(409).json({ message: 'A record with this value already exists.' });
  }

  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error('[Error]', message);
  }

  return res.status(status).json({ message });
}
