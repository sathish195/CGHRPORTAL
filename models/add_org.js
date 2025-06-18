const mongoose = require("mongoose");

const ORGANISATION_Schema = new mongoose.Schema(
  {
    organisation_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    organisation_name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    employee_id: { type: String, required: true, unique: true }, // Corrected field name to match 'employee_id'

    departments: { type: Array, default: [] },
    roles: [
      {
        role_id: { type: String, required: true },
        role_name: { type: String, required: true },
        admin_type: { type: String, required: true },
        leaves: [
          {
            leave_id: { type: String, required: true },
            leave_name: { type: String },
            total_leaves: { type: Number },
          },
        ],
      },
    ],
    // { type: Array, default: [] },
    // designations: {, default: [] },
    designations: { type: Array, default: [] },

    organisation_details: { type: Object, default: {} },
    images: { type: Object, default: {} },
    emp_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);
ORGANISATION_Schema.index({ organisation_id: 1, email: 1 });

exports.ORGANISATIONS = mongoose.model("ORGANISATIONS", ORGANISATION_Schema);
