const mongoose = require("mongoose");

const amenitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  count: { type: Number, required: true, min: 0 },
});

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
});

const listings_schema = new mongoose.Schema(
  {
    listing_id: { type: String, default: null, index: true },
    organisation_id: { type: String, required: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    area_sqft: { type: String, required: true },
    amenities: { type: [amenitySchema], default: [] },
    images: { type: [imageSchema], default: [] },
  },
  { timestamps: true }
);

listings_schema.index({ listing_id: 1 });

exports.LISTINGS = mongoose.model("LISTINGS", listings_schema);
