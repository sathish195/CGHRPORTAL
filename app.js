const express=require('express')
// const error_handler=require("../middlewares/error")


app=express()

app.use(express.json({ limit: "10mb" }));
// app.use(error_handler);
require("dotenv").config();


require("./helpers/cors")(app);
require("./helpers/db")();
require("./helpers/redisFunctions");


//error handling is pending
//compression is pending
//helmet is pending
//ratelimiter is pending
//slowdown is pending
//rate cutter is pending


require("./helpers/routeConfig")(app);


app.listen(process.env.PORT, () => {
    console.log(`Listening on port http://localhost:${process.env.PORT}`);
  });