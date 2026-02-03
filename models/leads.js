const { array, required } = require("joi");
const mongoose = require("mongoose");

const leads_schema = new mongoose.Schema(
  {
    lead_id: { type: String, required: true, unique: true, index: true },
    lead_name: { type: String },
    organisation_id: { type: String, required: true },
    key: { type: String, required: true },
    source: { type: String },
    email: { type: String, required: true },
    // company: { type: String },
    status: { type: String, required: true },
    assigned_to: { type: Array, default: [] },
    contact_number: { type: String },
    next_follow_up: { type: Date },
    comments: { type: String },
    files: { type: Array, default: [] },
    added_by: { type: Object, default: {} },
    updated_by: { type: Object, deafult: {} },
    listing_name: { type: String },
    price: { type: String },
    area: { type: String },
    address: { type: String },
    city: { type: String },
    type: { type: String },
    currency_symbol: { type: String },
    listing_type: { type: String },
    country: { type: String },
    others: { type: Object, default: {} },
  },
  { timestamps: true }
);
leads_schema.index({ lead_id: 1 });

exports.LEADS = mongoose.model("LEADS", leads_schema);
