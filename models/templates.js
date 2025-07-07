const mongoose = require("mongoose");

const template_schema = new mongoose.Schema(
  {
    template_id: { type: String, required: true, unique: true, index: true },
    headline: { type: String, required: true },
    subject: { type: String, required: true },
    type: { type: String, required: true },
    added_by: { type: Object, default: {} },
  },
  { timestamps: true }
);
template_schema.index({ template_id: 1 });

exports.TEMPLATES = mongoose.model("TEMPLATES", template_schema);
