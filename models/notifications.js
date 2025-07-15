const mongoose = require("mongoose");

const notifications_schema = new mongoose.Schema(
  {
    notification_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    organisation_id: { type: String, required: true },

    message: { type: String, required: true },

    for_roles: { type: [String], default: [] }, // e.g., ["1", "2"]

    for_employees: {
      type: [
        {
          employee_id: { type: String, required: true },
          employee_name: { type: String, required: true },
        },
      ],
      default: [],
    },

    added_by: {
      type: Object,
      default: {},
    },
    updated_by: { type: Object, default: {} },

    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for fast lookup
notifications_schema.index({ notification_id: 1 });

exports.NOTIFICATIONS = mongoose.model("NOTIFICATIONS", notifications_schema);
