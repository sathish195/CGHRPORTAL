const rateLimit = require("express-rate-limit");
module.exports = (time_in_sec, limit) => {
  return rateLimit({
    windowMs: time_in_sec * 1000, //1 * 60 * 1000,
    max: limit,
    message: "Too many requests from this IP, please try again after some time",
    keyGenerator: function (req) {
      console.log("req.employee-----", req.employee);

      // Ensure req.employee exists and has employee_id
      if (req.employee && req.employee.employee_id) {
        console.log(req.employee);
        return req.employee.employee_id;
      }
    },
  });
};
