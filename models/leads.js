const { array } = require("joi");
const mongoose = require("mongoose");

const leads_schema = new mongoose.Schema(
  {
    lead_id: { type: String, required: true, unique: true, index: true },
    lead_name: { type: String, required: true },
    organisation_id: { type: String, required: true },
    email: { type: String, required: true },
    company: { type: String, required: true },
    status: { type: String, required: true },
    assigned_to: { type: Array, default: [] },
    next_follow_up: { type: Date, required: true },
    added_by: { type: Object, default: {} },
  },
  { timestamps: true }
);
leads_schema.index({ lead_id: 1 });

exports.LEADS = mongoose.model("LEADS", leads_schema);
