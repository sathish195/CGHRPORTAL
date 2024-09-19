const mongoose = require("mongoose");

const attendance_Schema = new mongoose.Schema(
  {
    attendance_id: { type: String, required: true, unique: true, index: true },
    organisation_id: { type: String, required: true, index: true },
    employee_id: { type: String, required: true, index: true },
    employee_name: { type: String, required: true },
    actual_in_time: { type: Date },
    actual_out_time: { type: Date },
    status: { type: String },
    checkin: { type: Array, default: [] },
    checkout: { type: Array, default: [] },
    total_working_minutes: { type: Number, default: 0 },
    grace_time: { type: Number, default: 0 },
    late_by: { type: Number, default: 0 },
    late_checkin: { type: Boolean, default: false },
    others: { type: Object, default: {} },
    attendance_status: { type: String, default: "" },
  },
  { timestamps: true }
);

exports.ATTENDANCE = mongoose.model("ATTENDANCE", attendance_Schema);
