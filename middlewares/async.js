const { alertDev } = require("../helpers/telegram");

module.exports = function (handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (ex) {
      const errorMessage = `Error occurred:x::x::x::x:: ${ex}`;
      alertDev(errorMessage);
      next(ex);
    }
  };
};
