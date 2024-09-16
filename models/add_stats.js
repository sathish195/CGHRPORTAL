const mongoose = require("mongoose");


// Define default status values
const defaultStatusTrack = [
  { status: "new", count: 0 },
  { status: "in_progress", count: 0 },
  { status: "completed", count: 0 },
  { status: "under_review", count: 0 },
];

// Define the main schema
const statsSchema = new mongoose.Schema(
  {
    organisation_id: { type: String, required: true },
    employee_id: { type: String, required: true },
    status_track: {
      type: Array,
      default: defaultStatusTrack,
    },
  },
  { timestamps: true }
);

// Export the model
exports.STATS = mongoose.model("STATS", statsSchema);

