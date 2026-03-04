const mongoose = require("mongoose");

const callLogSchema = new mongoose.Schema(
  {
    callId: { type: String, index: true },

    from: { type: String, required: true },
    to: { type: String, required: true },

    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },

    status: {
      type: String,
      enum: ["completed", "missed", "rejected"],
      required: true,
    },

    duration: { type: Number, default: 0 }, // seconds
  },
  { timestamps: true }
);

module.exports.CALL_LOG = mongoose.model("CALL_LOG", callLogSchema);
