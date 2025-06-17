const mongoose = require("mongoose");

// Define the main schema
const stats_schema = new mongoose.Schema(
  {
    no_of_orgs: { type: Number },
  },
  { timestamps: true }
);

// Export the model
exports.ADMIN_STATS = mongoose.model("ADMIN_STATS", stats_schema);
