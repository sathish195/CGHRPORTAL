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

router.post(
  "/notifications",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const data = req.body;

    const admin_type = req.employee.admin_type;
    const employee_id = req.employee.employee_id;

    // ✅ Validate limit & skip
    const { error } = validations.skipLimit(data);
    if (error) return res.status(400).send(error.details[0].message);

    // ✅ Allow only specific admin types
    const allowed_types = ["1", "2", "3", "4"];
    if (!allowed_types.includes(admin_type)) {
      return res.status(403).send("Access Denied!");
    }

    // ✅ Base filter
    const filter = {
      organisation_id: req.employee.organisation_id,
    };

    // ✅ Role-based filter logic
    if (admin_type === "1" || admin_type === "2") {
      // Full access, no extra filter
    } else if (admin_type === "3") {
      // Access to notifications added by them OR addressed to them
      filter.$or = [
        { "added_by.employee_id": employee_id },
        { "for_employees.employee_id": employee_id },
      ];
    } else if (admin_type === "4") {
      // Access only to notifications addressed to them
      filter["for_employees.employee_id"] = employee_id;
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

module.exports = router;
