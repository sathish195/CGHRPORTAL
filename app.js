const express=require('express')

app=express()

app.use(express.json());


port=process.env.PORT

require("./helpers/cors")(app);
require("./helpers/db")();

require("./helpers/routeConfig")(app);


// app.listen(port,console.log("Listening on port 8080"));
app.listen(port, () => {
    console.log(`Listening on port http://localhost:${port}`);
  });