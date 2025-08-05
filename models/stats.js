const mongoose = require("mongoose");

// Define the main schema
const stats_schema = new mongoose.Schema(
  {
    stats_id: { type: Number },
    no_of_orgs: { type: Number },
    no_of_admins: { type: Number },
  },
  { timestamps: true }
);

// Export the model
exports.ADMIN_STATS = mongoose.model("ADMIN_STATS", stats_schema);
