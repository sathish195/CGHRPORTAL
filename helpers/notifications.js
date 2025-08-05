const mongoFunctions = require("./mongoFunctions");
const redisFunctions = require("./redisFunctions");
const functions = require("./functions");
const { alertDev } = require("./telegram");
const { mongo } = require("mongoose");

async function add_notification(data) {
  // Generate the notification ID
  const notification_id = functions.get_random_string("NOTIFY", 5, true);

  // Add the ID to the data object
  data.notification_id = notification_id;

  // Insert the record into the NOTIFICATIONS collection
  await mongoFunctions.create_new_record("NOTIFICATIONS", data);
}
module.exports = { add_notification };
