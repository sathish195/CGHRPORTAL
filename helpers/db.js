// const mongoose = require("mongoose");
// const { alertDev } = require("./telegram");
// // require('dotenv').config();
// module.exports = () => {
//   var connectionString = String(process.env.CRM_DBSTRING);
//   // console.log(connectionString);
//   // alertDev(connectionString);

//   mongoose
//     .connect(connectionString, {
//       autoIndex: true,
//     })
//     .then(() => console.log("Connected to ☘️ CG CRM MongoDB...!"))
//     .catch((err) => console.log(err));
// };




const mongoose = require("mongoose");
const Grid = require('gridfs-stream');


let gfs;

const connectDB = () => {
  const connectionString = process.env.CRM_DBSTRING;
  console.log(connectionString);

  mongoose
    .connect(connectionString, { autoIndex: true })
    .then(() => {
      console.log("Connected to ☘️  MongoDB (CRM UAT)...!");

      gfs = Grid(mongoose.connection.db, mongoose.mongo);
      gfs.collection('uploads');
      console.log('GridFS ready!');
    })
    .catch((err) => console.log(err));
};

const getGfs = () => {
  if (!gfs) throw new Error('GridFS not initialized yet');
  return gfs;
};

module.exports = {connectDB, getGfs};