const express=require('express')

app=express()

app.use(express.json());

require("./helpers/routeConfig")(app);
require("./helpers/db")();
require("./helpers/cors")(app);


port=process.env.PORT
// app.listen(port,console.log("Listening on port 8080"));
app.listen(port, () => {
    console.log(`Listening on port http://localhost:${port}`);
  });