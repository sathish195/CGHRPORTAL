var cron = require("node-cron");
const mongoFunctions = require("./mongoFunctions");

cron.schedule(
  "0 0 * * *",
  () => {
    // let attendance=mongoFunctions.find()

    console.log("Running a job every day at 12:00 AM at Asia/Kolkata timezone");
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);
