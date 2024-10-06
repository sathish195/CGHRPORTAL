const { required } = require("joi");
const mongoose = require("mongoose");

const Holiday_schema = new mongoose.Schema(
  {
    holiday_id: { type: String, required: true, unique: true, index: true },
    organisation_id: { type: String, required: true, index: true },
    holiday_name: { type: String, required: true, index: true },
    holiday_date: { type: Date, required: true },
    added_by: { type: Object },
    modified_by: { type: Array },
  },
  { timestamps: true }
);

Holiday_schema.index({ organisation_id: 1, holiday_id: 1 });
Holiday_schema.index({ organisation_id: 1, holiday_id: 1, holiday_name: 1 });

exports.HOLIDAYS = mongoose.model("HOLIDAYS", Holiday_schema);
