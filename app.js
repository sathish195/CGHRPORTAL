const express=require('express')

app=express()

app.use(express.json({ limit: "10mb" }));


port=process.env.PORT

require("./helpers/cors")(app);
require("./helpers/db")();
//process.env is pending
//error handling is pending
//redis is pending
//compression is pending
//helmet is pending
//ratelimiter is pending
//slowdown is pending
//rate cutter is pending


require("./helpers/routeConfig")(app);


// app.listen(port,console.log("Listening on port 8080"));
app.listen(process.env.PORT, () => {
    console.log(`Listening on port http://localhost:${process.env.PORT}`);
  });