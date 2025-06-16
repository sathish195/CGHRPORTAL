const mongoose = require("mongoose");

const controls_schema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    // Store as boolean
    login: {
      type: Boolean,
      required: true,
      default: false,
    },

    add_organisation: {
      type: Boolean,
      required: true,
      default: false,
    },
    add_admin: {
      type: Boolean,
      required: true,
      default: false,
    },

    suspend_organisation: {
      type: Boolean,
      required: true,
      default: false,
    },

    approve_organisation: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
);
controls_schema.index({ email: 1 });

exports.ADMIN_CONTROLS = mongoose.model("ADMIN_CONTROLS", controls_schema);
