const {slowDown} = require('express-slow-down');

module.exports = slowDown({
  windowMs: 1 * 1000, //1 seconds
  delayAfter: 1, //allow 1 req for 1 seconds
  delayMs:(hits)=>hits * 1000, //after that add 2 seconds
  keyGenerator: function (req /*, res*/) {
    return req.user.userid;
  },
  handler: (request, response, next, options) => {
		if (request.rateLimit.used === request.rateLimit.limit + 1) {
      return 'user limit reached';
		}
		response.status(options.statusCode).send(options.message)
	},
});