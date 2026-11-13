const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// Use Express router.param so malformed UUIDs produce a controlled 400 instead
// of avoidable PostgreSQL invalid-text errors (and noisy 500s in the logs).
export function validateUuidParam(_req, res, next, value) {
  if (!isUuid(value)) {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: 'شناسهٔ درخواست معتبر نیست.' },
    });
  }
  return next();
}
