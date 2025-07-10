const mongoose = require("mongoose");

const postings_schema = new mongoose.Schema(
  {
    posting_id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    images: { type: Object, default: {} },
    added_by: { type: Object, default: {} },
  },
  { timestamps: true }
);
postings_schema.index({ posting_id: 1 });

exports.POSTINGS = mongoose.model("POSTINGS", postings_schema);
