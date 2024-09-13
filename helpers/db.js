const mongoose = require("mongoose");
// require('dotenv').config();
module.exports = () => {
  var connectionString = String(process.env.CRM_DBSTRING);
  // console.log(connectionString)
  mongoose
    .connect(connectionString, {
      autoIndex: true,
    })
    .then(() => console.log("Connected to ☘️ CG CRM MongoDB...!"))
    .catch((err) => console.log(err));
};
