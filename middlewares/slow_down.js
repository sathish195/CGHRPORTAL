const { slowDown } = require("express-slow-down");

module.exports = slowDown({
  windowMs: 1 * 1000,
  delayAfter: 1, // Allow 1 request per 1 second
  delayMs: (hits) => hits * 1000,
  keyGenerator: function (req) {
    // Ensure req.employee exists and has employee_id
    if (req.employee && req.employee.employee_id) {
      return req.employee.employee_id;
    }
  },
  handler: (request, response, next, options) => {
    // Send custom response when rate limit is exceeded
    if (request.rateLimit.used > request.rateLimit.limit) {
      return response.status(429).send("User limit reached");
    }
  },
});
