const { slowDown } = require('express-slow-down');

module.exports = slowDown({
  windowMs: 1 * 1000, // 1 second
  delayAfter: 1, // Allow 1 request per 1 second
  delayMs: (hits) => hits * 1000, // Add increasing delay for each additional request
  keyGenerator: function (req ) {
    // Ensure req.employee exists and has employee_id
    if (req.employee && req.employee.employee_id) {
      return req.employee.employee_id;
    } else {
      // Handle the case where req.employee or req.employee.employee_id is not defined
      // Use a default key if employee_id is not available
      return 'anonymous';
    }
  },
  handler: (request, response, next, options) => {
    // Send custom response when rate limit is exceeded
    if (request.rateLimit.used > request.rateLimit.limit) {
      // Delay logic is handled by the middleware itself; no need to call next() here
      return response.status(429).send('User limit reached');
    }
    // Call next to pass control to the next middleware or route handler
    next();
  },
});
