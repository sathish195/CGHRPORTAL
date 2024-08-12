const mongoose = require("mongoose");

const ORGANISATION_Schema = new mongoose.Schema(
  {
    organisation_id: { type: String, required: true, unique: true },
    organisation_name: { type: String, required: true },
    email: { type: String, required: true },
    employee_id: { type: String, required: true, unique: true }, // Corrected field name to match 'employee_id'

    departments: { type: Array, default: [] },
    roles: { type: Array, default: [] },
    designations: { type: Array, default: [] },

    organisation_details: { type: Object, default: {} },
    images: { type: Object, default: {} },
  },
  { timestamps: true }
);

exports.ORGANISATIONS = mongoose.model("ORGANISATIONS", ORGANISATION_Schema);