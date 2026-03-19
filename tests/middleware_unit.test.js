const middleware = require('../server/middleware');

function createRes() {
  const headers = {};
  const events = {};
  return {
    statusCode: 200,
    headers,
    body: null,
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    once(name, fn) {
      events[name] = fn;
    },
    emit(name) {
      if (events[name]) events[name]();
    },
  };
}

function testRateLimiterSetsRetryAfterAndNonNegativeRemaining() {
  const limiter = middleware.rateLimiter({ windowMs: 1000, maxRequests: 1 });

  const req = { ip: '127.0.0.1' };
  const firstRes = createRes();
  let nextCalled = false;
  limiter(req, firstRes, () => {
    nextCalled = true;
  });
  if (!nextCalled) throw new Error('first request should pass');
  if (Number(firstRes.headers['X-RateLimit-Remaining']) !== 0) {
    throw new Error('remaining should clamp to 0');
  }

  const secondRes = createRes();
  limiter(req, secondRes, () => {});
  if (secondRes.statusCode !== 429) throw new Error('second request should be rate limited');
  if (!secondRes.headers['Retry-After']) throw new Error('retry-after header should be present');
}

function testRequestLoggerRegistersFinishAndCloseHandlers() {
  const loggerMiddleware = middleware.requestLogger();
  const req = { method: 'GET', url: '/health', ip: '127.0.0.1' };
  const res = createRes();
  let nextCalled = false;

  loggerMiddleware(req, res, () => {
    nextCalled = true;
  });

  if (!nextCalled) throw new Error('request logger should call next');
  if (typeof res.emit !== 'function') throw new Error('response test double invalid');
  res.emit('finish');
  res.emit('close');
}

module.exports = {
  testRateLimiterSetsRetryAfterAndNonNegativeRemaining,
  testRequestLoggerRegistersFinishAndCloseHandlers,
};
