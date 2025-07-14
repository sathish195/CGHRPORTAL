const mongoose = require("mongoose");

const events_schema = new mongoose.Schema(
  {
    event_id: { type: String, required: true, unique: true, index: true },
    organisation_id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    added_by: { type: Object, default: {} },
    type: { type: String, required: true },
    assigned_to: { type: Array, default: [] },
  },
  { timestamps: true }
);
events_schema.index({ event_id: 1 });

exports.EVENTS = mongoose.model("EVENTS", events_schema);
