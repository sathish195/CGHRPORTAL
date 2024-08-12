const mongoose = require('mongoose')

const EMPLOYEE_Schema=new mongoose.Schema({
    organisation_id: { type: String, required: true },
    organisation_name: { type: String, required: true },
    password:{ type: String, required: true},
    employee_id: { type: String, required: true, unique: true },
    basic_info: { type: Object, default: {} },
    work_info: { type: Object, default: {} },
    personal_details: { type: Object, default: {} },
    identity_info: { type: Object, default: {} },
    contact_details: { type: Object, default: {} },
    work_experience: { type: Array, default: [] },
    educational_details: { type: Array, default: [] },
    dependent_details: { type: Array, default: [] },
    leaves: { type: Object, default: {} },
    images: { type: Object, default: {} },
    files: { type: Object, default: {} },
    last_ip: { type: String, default: "0.0.0.0" },
    browserid: { type: String, default: "0" },
    fcm_token: { type: String, default: "0" },
    device_id: { type: String, default: "0" },
    two_fa_key: { type: String, default: "0" },
    two_fa_status: {
      type: String,
      enum: ["Enable", "Disable"],
      default: "Disable",
    },
  },
  { timestamps: true },
);

exports.EMPLOYEE = mongoose.model('Employees', EMPLOYEE_Schema)