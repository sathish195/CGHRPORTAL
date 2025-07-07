const mongoose = require("mongoose");

const email_schema = new mongoose.Schema(
  {
    email_id: { type: String, required: true, unique: true, index: true },
    from: { type: String, required: true },
    organisation_id: { type: String, required: true },
    to: { type: String, required: true },
    cc: { type: String, required: true },
    subject: { type: String, required: true },
    link_to_record: { type: String, required: true },
    message: { type: String, required: true },
    files: { type: Object, default: {} },
    sent_by: { type: Object, default: {} },
    status: { type: String, required: true },
  },
  { timestamps: true }
);
email_schema.index({ email_id: 1 });

exports.EMAILS = mongoose.model("EMAILS", email_schema);
