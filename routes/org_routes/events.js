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

// Events deadlines within the next 7 days
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

    // ✅ Access control
    const allowed_types = ["1", "2", "3", "4"];
    if (!allowed_types.includes(admin_type)) {
      return res.status(403).send("Access Denied!");
    }

    // ✅ Build filter
    const filter = {
      organisation_id: req.employee.organisation_id,
      $or: [
        { for_roles: admin_type },
        { "for_employees.employee_id": employee_id },
      ],
    };

    // ✅ Fetch notifications with pagination
    const [notifications, total] = await Promise.all([
      mongoFunctions.lazy_loading(
        "NOTIFICATIONS",
        filter,
        {},
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

//remainders or notifications

module.exports = router;
