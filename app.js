const express=require('express')

app=express()

app.use(express.json());

require("./helpers/routeConfig")(app);
require("./helpers/db")();
require("./helpers/cors")(app);



app.listen(8080,console.log("Listening on port 8080"));