const express=require('express')


app=express()
app.set('trust proxy', 1);

app.use(express.json({ limit: "10mb" }));
// app.use(error_handler);
require("dotenv").config();


require("./helpers/cors")(app);
require("./helpers/db")();
require("./helpers/redisFunctions");


require("./helpers/routeConfig")(app);


app.listen(process.env.PORT, () => {
    console.log(`Listening on port http://localhost:${process.env.PORT}`);
  });