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

    type: {
      type: String,
      //   enum: ["event", "employee", "task", "lead", "announcement"],
      required: true,
    },

    action: {
      type: String,
      enum: ["added", "updated", "assigned", "deleted"],
      required: true,
    },

    message: { type: String, required: true },

    for_roles: { type: [String], default: [] }, // e.g., ["1", "2"]

    for_employees: {
      type: [
        {
          employee_id: { type: String, required: true },
          name: { type: String, required: true },
        },
      ],
      default: [],
    },

    added_by: {
      employee_id: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, required: true },
    },

    updated_by: {
      employee_id: { type: String },
      name: { type: String },
      email: { type: String },
    },

    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for fast lookup
notifications_schema.index({ notification_id: 1 });

exports.NOTIFICATIONS = mongoose.model("NOTIFICATIONS", notifications_schema);
