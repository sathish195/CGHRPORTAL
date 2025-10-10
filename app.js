require("dotenv").config();
const express = require("express");

app = express();
app.set("trust proxy", 1);

// app.use(express.json({ limit: "10mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

require("./helpers/cors")(app);
require("./helpers/db")();
require("./helpers/redisFunctions");
require("./helpers/cron_job");

require("./helpers/routeConfig")(app);

app.listen(process.env.PORT, () => {
  console.log(`Listening on port http://localhost:${process.env.PORT}`);
});
