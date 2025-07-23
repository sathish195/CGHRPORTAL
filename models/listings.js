const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  pincode: {
    type: String,
    match: [/^\d{6}$/, "Pincode must be a 6-digit number"],
  },
  landmark: { type: String, default: "" },
  latitude: { type: Number, default: 0 },
  longitude: { type: Number, default: 0 },
});

const amenitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  count: { type: Number, required: true, min: 0 },
});

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
});

const listingSchema = new mongoose.Schema(
  {
    location: { type: locationSchema, default: {} },
    organisation_id: { type: String, required: true },
    key: { type: String, required: true },
    type: { type: String, required: true },
    price: { type: Number, required: true },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    balconies: { type: Number, default: 0 },

    listing_id: { type: String, required: true }, // ✅ now required
    name: { type: String, required: true },
    description: { type: String, required: true },
    area_sqft: { type: String, required: true },

    amenities: { type: [amenitySchema], default: [] },
    images: { type: [imageSchema], default: [] },
  },
  { timestamps: true }
);
// Index for fast lookup
listingSchema.index({ listing_id: 1 });

exports.LISTINGS = mongoose.model("LISTINGS", listingSchema);
