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

    // Validate limit & skip
    const { error } = validations.skipLimit(data);
    if (error) return res.status(400).send(error.details[0].message);

    // Access control
    const admin_types = ["1", "2", "3", "4"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res.status(403).send("Access Denied!");
    }
  })
);
//remainders or notifications

module.exports = router;
