const mongoose = require("mongoose");

const leave_Schema = new mongoose.Schema(
  {
    leave_application_id: { type: String, required: true, unique: true },
    organisation_id: { type: String, required: true },
    employee_id: { type: String, required: true },
    leave_type_id: { type: String, required: true },
    leave_type: { type: String, required: true },
    employee_name: { type: String, required: true },
    email: { type: String, required: true },
    days_taken: { type: Number, required: true },
    from_date: { type: Date, required: true },
    to_date: { type: Date, required: true },
    reason: { type: String, required: true },
    team_mail_id: { type: String, required: true },
    leave_status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      required: true,
    },
    approved_by: { type: Array, default: [] },
  },
  { timestamps: true }
);

exports.LEAVE = mongoose.model("LEAVE", leave_Schema);