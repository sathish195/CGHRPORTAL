const jwt = require("jsonwebtoken");

module.exports = {
  Auth(req, res, next) {
    const token = req.headers["x-auth-token"];
    if (!token) {
      return res.status(401).send({ message: "Token not provided" });
    }
    console.log(token);
    try {
      const decoded = jwt.verify(token, process.env.jwtPrivateKey);
      req.employee = decoded;
      if (req.employee.status === "disable") {
        return res
          .status(401)
          .send({ message: "Token is not valid for disabled account" });
      }
      next();
    console.log("testing------------------------------------->");

    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).send({ message: "Token Is Expired" });
      }
      return res.status(400).send({ message: "Token is not valid" });
    }
  },
};
