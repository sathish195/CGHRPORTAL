const mongoose = require("mongoose");
const { employee_id } = require("../helpers/schema");

const EMPLOYEE_Schema = new mongoose.Schema(
  {
    organisation_id: { type: String, required: true, index: true },
    organisation_name: { type: String, required: true },
    password: { type: String, required: true },
    employee_id: { type: String, required: true, index: true },
    basic_info: {
      first_name: { type: String },
      last_name: { type: String },
      nick_name: { type: String },
      email: { type: String, index: true, required: true, unique: true },
    },
    work_info: {
      department_id: { type: String },
      department_name: { type: String },
      role_id: { type: String },
      role_name: { type: String },
      admin_type: { type: String },
      designation_id: { type: String },
      designation_name: { type: String },
      employment_type: { type: String },
      employee_status: { type: String },
      source_of_hire: { type: String },
      reporting_manager: { type: String },
      date_of_join: { type: Date },
    },

    personal_details: {
      date_of_birth: { type: Date },
      expertise: { type: String },
      gender: { type: String },
      marital_status: { type: String },
      about_me: { type: String },
    },
    identity_info: {
      uan: { type: String, default: "" },
      pan: { type: String, default: "" },
      aadhaar: { type: String, default: "" },
      passport_number: { type: String, default: "" },
      emirates_id: { type: String, default: "" },
      labour_card_id: { type: String, default: "" },
      passport_attachment: { type: Array, default: [] },
      emirates_attachment: { type: Array, default: [] },
      labour_card_attachment: { type: Array, default: [] },
      other_attachments: { type: Array, default: [] },
    },
    contact_details: {
      mobile_number: { type: String },
      personal_email_address: { type: String },
      seating_location: { type: String },
      present_address: { type: String },
      permanent_address: { type: String },
    },
    work_experience: {
      type: [
        {
          company_name: { type: String, default: "" },
          job_title: { type: String, default: "" },
          from_date: { type: Date, default: null },
          to_date: { type: Date, default: null },
          job_description: { type: String, default: "" },
          // experience: { type: String }
        },
      ],
    },

    educational_details: {
      type: [
        {
          institute_name: { type: String, default: "" },
          degree: { type: String, default: "" },
          specialization: { type: String, default: "" },
          year_of_completion: { type: String, default: 0 },
        },
      ],
    },
    dependent_details: {
      type: [
        {
          name: { type: String, default: "" },
          relation: { type: String, default: "" },
          dependent_mobile_number: { type: String, default: "" },
        },
      ],
    },
    leaves: [
      {
        leave_id: { type: String },
        leave_name: { type: String },
        total_leaves: { type: Number },
        remaining_leaves: { type: Number },
      },
    ],
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
    avatar: String,
    about: String,

    user_status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "inactive",
      // index: true,
    },

    presence_status: {
      type: String,
      enum: ["online", "offline", "away"],
      default: "offline",
    },

    lastSeen: Date,

    devices: [
      {
        socketId: String,
        platform: String,
        lastActive: Date,
      },
    ],
    permissions: { type: Object, default: {} },
    
  },
  { timestamps: true }
);
EMPLOYEE_Schema.index({ createdAt: 1 });
EMPLOYEE_Schema.index({ organisation_id: 1, employee_id: 1 });
EMPLOYEE_Schema.index({ organisation_id: 1, "basic_info.email": 1 });
EMPLOYEE_Schema.index({
  organisation_id: 1,
  "basic_info.email": 1,
  employee_id: 1,
});
exports.EMPLOYEE = mongoose.model("Employees", EMPLOYEE_Schema);
