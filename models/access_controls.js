const mongoose = require("mongoose");

const controls_schema = new mongoose.Schema(
  {
    control_id: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    organisation_id: { type: String, required: true },
    status: { type: Boolean, required: true },
    assigned_to: { type: Array, default: [] },
  },
  { timestamps: true }
);
controls_schema.index({ control_id: 1 });

exports.ACCESS_CONTROLS = mongoose.model("ACCESS_CONTROLS", controls_schema);
