const mongoose = require("mongoose");

const Sadmin_schema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    profile_picture: { type: String, required: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);
Sadmin_schema.index({ email: 1 });

exports.SUPER_ADMIN = mongoose.model("SUPER_ADMIN", Sadmin_schema);
