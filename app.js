const express=require('express')

app=express()

app.use(express.json());

require("./helpers/routeConfig")(app);
require("./helpers/db")();
require("./helpers/cors")(app);



app.listen(3000,console.log("Listening on port 3000"));