const express = require("express");
const mongoFunctions = require("../../helpers/mongoFunctions");
const router = express.Router();
const validations = require("../../helpers/schema");
const bcrypt = require("../../helpers/crypto");
const jwt = require("jsonwebtoken");
const { Auth } = require("../../middlewares/auth");
// const redis = require("../../helpers/redisFunctions");
const functions = require("../../helpers/functions");
const stats = require("../../helpers/stats");
const { mongo } = require("mongoose");
const Fuse = require("fuse.js");
const Async = require("../../middlewares/async");
const rateLimit = require("../../helpers/custom_rateLimiter");
const slowDown = require("../../middlewares/slow_down");
const { alertDev } = require("../../helpers/telegram");
const multer = require("multer");
const redisFunctions = require("../../helpers/redisFunctions");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const fsp = require("fs").promises;
const moment = require("moment");
const encrypt_decrypt = require("../../helpers/encrypt_decrypt");

router.post(
  "/notifications",
  Auth,
  rateLimit(60, 60),
  Async(async (req, res) => {
    const data = req.body;

    const admin_type = req.employee.admin_type;
    const employee_id = req.employee.employee_id;

    // ✅ Validate limit & skip
    const { error } = validations.skipLimit(data);
    if (error) return res.status(400).send(error.details[0].message);

    // ✅ Access control
    const allowed_types = ["1", "2", "3", "4"];
    if (!allowed_types.includes(admin_type)) {
      return res.status(403).send("Access Denied!");
    }

    // ✅ Base filter
    const filter = {
      organisation_id: req.employee.organisation_id,
    };

    // ✅ Role-based logic
    if (admin_type === "1" || admin_type === "2") {
      // Full access, no further filter needed
    } else if (admin_type === "3") {
      // Access if:
      // - added_by is them
      // - OR for_employees contains them
      // - OR for_roles contains their admin_type
      filter.$or = [
        { "added_by.employee_id": employee_id },
        { "for_employees.employee_id": employee_id },
        { for_roles: admin_type },
      ];
    } else if (admin_type === "4") {
      // Access if:
      // - for_employees contains them
      // - OR for_roles contains their admin_type
      filter.$or = [
        { "for_employees.employee_id": employee_id },
        { for_roles: admin_type },
      ];
    }

    // ✅ Fetch notifications with pagination
    const [notifications, total] = await Promise.all([
      mongoFunctions.lazy_loading(
        "NOTIFICATIONS",
        filter,
        { _id: 0, message: 1 },
        { created_at: -1 },
        data.limit,
        data.skip
      ),
      mongoFunctions.count_documents("NOTIFICATIONS", filter),
    ]);

    return res.status(200).send({
      notifications,
      count: total,
    });
  })
);

//listings route(no auth route)
router.post(
  "/add_update_listings",
  rateLimit(60, 20),
  Async(async (req, res) => {
    const rawInput = encrypt_decrypt.decryptobj(req.body.enc);

    // ✅ Validate input
    const { error, value: data } = validations.add_update_listings(rawInput);
    if (error) return res.status(400).send(error.details[0].message);

    // ✅ Access control check
    const keys = ["scanglobal", "crm"];
    if (!keys.includes(data.key)) {
      return res.status(403).send("Access denied");
    }

    // ✅ Validate route_action
    const allowedActions = [1, 2, 3];
    if (!allowedActions.includes(data.route_action)) {
      return res.status(400).send("Invalid route_action provided");
    }

    // ✅ Construct listings object
    const listings_object = {
      organisation_id: data.organisation_id,
      name: data.name || "",
      description: data.description,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      balconies: data.balconies,
      price: data.price,
      type: data.type,
      location: data.location || {},
      area_sqft: data.area_sqft || null,
      images: data.images || [],
      amenities: data.amenities || [],
      key: data.key,
    };

    let listings;

    // ➕ ADD
    if (data.route_action === 1) {
      const new_listing_id = functions.get_random_string("LIST", 10, true);
      listings_object.listing_id = new_listing_id;

      listings = await mongoFunctions.create_new_record(
        "LISTINGS",
        listings_object
      );

      return res.status(200).send({
        message: "Listing Added Successfully",
      });
    }

    // 🔄 UPDATE
    if (data.route_action === 2) {
      if (!data.listing_id || data.listing_id.length <= 2) {
        return res.status(400).send("Listing ID required for update");
      }

      const existing_listing = await mongoFunctions.find_one("LISTINGS", {
        listing_id: data.listing_id,
        organisation_id: data.organisation_id,
        key: data.key,
      });

      if (!existing_listing) {
        return res.status(404).send("Listing not found for update");
      }

      listings = await mongoFunctions.find_one_and_update(
        "LISTINGS",
        {
          listing_id: data.listing_id,
          organisation_id: data.organisation_id,
          key: data.key,
        },
        { $set: listings_object }
      );

      return res.status(200).send({
        message: "Listing Updated Successfully",
      });
    }

    // ❌ DELETE
    if (data.route_action === 3) {
      if (!data.listing_id || data.listing_id.length <= 2) {
        return res.status(400).send("Listing ID required for deletion");
      }

      const result = await mongoFunctions.find_one_and_delete("LISTINGS", {
        listing_id: data.listing_id,
        organisation_id: data.organisation_id,
        key: data.key,
      });

      if (!result) {
        return res.status(404).send("Listing not found for deletion");
      }

      return res.status(200).send({
        message: "Listing Deleted Successfully",
      });
    }
  })
);

//get postings(no auth route)
router.post(
  "/listings",
  rateLimit(60, 60),
  Async(async (req, res) => {
    const data = encrypt_decrypt.decryptobj(req.body.enc);
    console.log(data);

    // Validate limit & skip
    const { error } = validations.get_listings(data);
    if (error) return res.status(400).send(error.details[0].message);

    ///Access control from payload
    const keys = ["scanglobal", "crm"];
    if (!keys.includes(data.key)) {
      return res.status(403).send("Access denied");
    }
    // ✅ If postings_id is provided, return single post
    if (data.listing_id && data.listing_id.trim() !== "") {
      const post = await mongoFunctions.find_one(
        "LISTINGS",
        {
          listing_id: data.listing_id,
          organisation_id: data.organisation_id,
          key: data.key,
        },
        { key: 0, _id: 0, __v: 0, organisation_id: 0 }
      );

      if (!post) return res.status(404).send("Listing not found");

      return res.status(200).send({ listing: post });
    }

    // Base filter
    const filters = {
      organisation_id: data.organisation_id,
      key: data.key,
    };

    // ✅ Add date filter only if date is not null or empty string
    if (data.date && data.date !== "") {
      const startOfDay = new Date(data.date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(data.date);
      endOfDay.setHours(23, 59, 59, 999);

      filters.date = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    // Fetch filtered postings
    const find_listings = await mongoFunctions.lazy_loading(
      "LISTINGS",
      filters,
      { key: 0, _id: 0, __v: 0, "location._id": 0, organisation_id: 0 },
      { createdAt: -1 },
      data.limit,
      data.skip
    );
    const cleanId = (array) => {
      if (!Array.isArray(array)) return;
      array.forEach((item) => {
        if (item && typeof item === "object") {
          if ("_id" in item) delete item._id;
        }
      });
    };

    for (const listing of find_listings) {
      cleanId(listing.images);
      cleanId(listing.amenities);
    }

    const count = await mongoFunctions.count_documents("LISTINGS", {
      organisation_id: data.organisation_id,
      key: data.key,
    });

    // Return result
    return res.status(200).send({
      listings: find_listings,
      count: count,
    });
  })
);

module.exports = router;
