const express = require("express");
const mongoFunctions = require("../../helpers/mongoFunctions");
const router = express.Router();
const validations = require("../../helpers/schema");
const bcrypt = require("../../helpers/crypto");
const jwt = require("jsonwebtoken");
const { Auth } = require("../../middlewares/auth");
const redis = require("../../helpers/redisFunctions");
const stats = require("../../helpers/stats");
const functions = require("../../helpers/functions");
const { date, func } = require("joi");
const { RFC_2822 } = require("moment");
const Async = require("../../middlewares/async");
const rateLimit = require("../../helpers/custom_rateLimiter");
const redisFunctions = require("../../helpers/redisFunctions");
const slowDown = require("../../middlewares/slow_down");

//dummy route to add super admin

router.post(
  "/add_update_super_admin",
  Async(async (req, res) => {
    const data = req.body;
    var { error } = validations.add_super_admin(data);
    if (error) return res.status(400).send(error.details[0].message);

    let find_super_admin = await mongoFunctions.find_one("SUPER_ADMIN", {
      email: data.email.toLowerCase(),
    });

    const new_password = "Superadmin@1234";

    let password_hash = await bcrypt.hash_password(new_password);

    let new_s_admin_data = {
      password: password_hash,

      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      profile_picture: data.profile_picture,
    };
    let new_s_admin = await mongoFunctions.find_one_and_update(
      "SUPER_ADMIN",
      { email: data.email },
      new_s_admin_data,
      { password: 0 },
      { upsert: true, returnDocument: "after" }
    );
    console.log("added super admin in database");
    await redisFunctions.update_redis("SUPER_ADMIN", new_s_admin);

    return res.status(200).send({
      success: "Super Admin Added Successfully..!!",
    });
  })
);

//super admin login route

router.post(
  "/login",
  rateLimit(60, 40),
  Async(async (req, res) => {
    data = req.body;
    console.log(data);
    //validate data
    var { error } = validations.Sadmin_login(data);
    if (error) return res.status(400).send(error.details[0].message);
    let s_admin = await redis.redisGet("CG_SUPER_ADMIN", data.email, true);

    if (!s_admin) {
      return res
        .status(403)
        .send("No Super Admin Found With The Given Email!!");
    }

    const validPassword = await bcrypt.compare_password(
      data.password,
      s_admin.password
    );
    console.log(validPassword);
    console.log(s_admin.password);
    if (!validPassword) return res.status(400).send("Incorrect Password");

    const up_s_admin = await mongoFunctions.find_one_and_update(
      "SUPER_ADMIN",
      { email: s_admin.email },
      {
        last_ip: data.last_ip,
        fcm_token: data.fcm_token,
        device_id: data.device_id,
        browserid: data.browserid,
      }
    );

    const token = jwt.sign(
      {
        email: up_s_admin.email,
        name: "super_admin",
      },
      process.env.jwtPrivateKey,
      { expiresIn: "7d" }
    );
    console.log(token);

    return res.status(200).send({
      success: "Logged In Successfully",
      token: token,
    });
  })
);

//route to add org admin

router.post(
  "/add_update_admin",
  Auth,
  Async(async (req, res) => {
    const data = req.body;
    console.log(req.employee);

    const { error } = validations.add_admin_emp(data);
    if (error) return res.status(400).send(error.details[0].message);

    // Only Super Admin can perform this
    let find_s_admin = await redis.redisGet(
      "CG_SUPER_ADMIN",
      req.employee.email,
      true
    );

    if (!find_s_admin || req.employee.email !== find_s_admin.email) {
      return res.status(403).send("Only Super Admin Can Have Access!!");
    }

    const find_emp = await mongoFunctions.find_one("EMPLOYEE", {
      "basic_info.email": req.employee.email.toLowerCase(),
    });

    if (find_emp) {
      return res.status(400).send("Admin Already Exists");
    }

    const new_password = "Admin@1234";
    const password_hash = await bcrypt.hash_password(new_password);

    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

    const new_emp_data = {
      organisation_id: functions.get_random_string("O", 5, true),
      organisation_name: "not_added",
      password: password_hash,
      employee_id: functions.get_random_string("O", 7, true),

      basic_info: {
        first_name: data.first_name,
        last_name: data.last_name,
        nick_name: "not_added",
        email: data.email.toLowerCase(),
      },

      work_info: {
        department_id: "not_added",
        department_name: "not_added",
        role_id: "not_added",
        role_name: "not_added",
        admin_type: "1",
        designation_id: "not_added",
        designation_name: "not_added",
        employment_type: "Full-time",
        employee_status: data.status,
        source_of_hire: "Direct",
        reporting_manager: "",
        date_of_join: today,
      },

      personal_details: {
        date_of_birth: today,
        expertise: "not_added",
        gender: "not_added",
        marital_status: "not_added",
        about_me: "not_added",
      },

      identity_info: {
        uan: "not_added",
        pan: "not_added",
        aadhaar: "not_added",
        passport: "not_added",
      },

      contact_details: {
        mobile_number: "not_added",
        personal_email_address: "not_added",
        seating_location: "not_added",
        present_address: "not_added",
        permanent_address: "not_added",
      },

      work_experience: [],

      educational_details: [
        {
          institute_name: "not_added",
          degree: "not_added",
          specialization: "not_added",
          year_of_completion: 0,
        },
      ],

      dependent_details: [],
      leaves: [],
      images: {},
      files: {},
    };

    const new_admin = await mongoFunctions.find_one_and_update(
      "EMPLOYEE",
      { "basic_info.email": new_emp_data.basic_info.email },
      { $set: new_emp_data },
      { upsert: true, new: true }
    );

    console.log("added admin in database");

    return res.status(200).send({
      success: "Admin Details Added Successfully!!",
      data: {
        email: new_emp_data.basic_info.email,
        first_name: new_emp_data.basic_info.first_name,
        last_name: new_emp_data.basic_info.last_name,
      },
    });
  })
);

router.post(
  "/add_update_admin_controls",
  Auth,
  Async(async (req, res) => {
    const data = req.body;

    // Validate input
    var { error } = validations.add_update_admin_controls(data);
    if (error) return res.status(400).send(error.details[0].message);

    // Only Super Admin can perform this
    let find_s_admin = await redis.redisGet(
      "CG_SUPER_ADMIN",
      req.employee.email,
      true
    );

    if (!find_s_admin || req.employee.email !== find_s_admin.email) {
      return res.status(403).send("Only Super Admin Can Have Access!!");
    }

    let controls_object = {
      email: req.employee.email,
      login: data.login,
      add_organisation: data.add_organisation,
      add_admin: data.add_admin,
      suspend_organisation: data.suspend_organisation,
      approve_organisation: data.approve_organisation,
    };

    // Update or insert admin controls
    const updated_controls = await mongoFunctions.find_one_and_update(
      "ADMIN_CONTROLS",
      { email: req.employee.email },
      { $set: controls_object },
      { upsert: true, new: true }
    );

    // Update Redis
    await redisFunctions.update_redis("ADMIN_CONTROLS", updated_controls);

    return res.status(200).send({
      message: "Admin Controls Added Successfully",
      admin_controls: updated_controls,
    });
  })
);

//-----------------------------------get routes---------------------------------------------

router.post(
  "/get_admins",
  Auth,
  Async(async (req, res) => {
    // Only Super Admin can perform this
    let find_s_admin = await redis.redisGet(
      "CG_SUPER_ADMIN",
      req.employee.email,
      true
    );

    if (!find_s_admin || req.employee.email !== find_s_admin.email) {
      return res.status(403).send("Only Super Admin Can Have Access!!");
    }

    // find_admins
    const find_admins = await mongoFunctions.find(
      "EMPLOYEE",
      { "work_info.admin_type": "1" },
      { createdAt: -1 }, // Sort by latest
      {
        _id: 0,
        "basic_info.email": 1,
        "basic_info.first_name": 1,
        "basic_info.last_name": 1,
        "work_info.employee_status": 1,
      }
    );

    const flattenedAdmins = find_admins.map((admin) => ({
      first_name: admin.basic_info.first_name,
      last_name: admin.basic_info.last_name,
      email: admin.basic_info.email,
      employee_status: admin.work_info.employee_status,
    }));

    return res.status(200).send({
      admins: flattenedAdmins,
    });
  })
);

//get orgs route

router.post(
  "/get_orgs",
  Auth,
  Async(async (req, res) => {
    // Only Super Admin can perform this
    let find_s_admin = await redis.redisGet(
      "CG_SUPER_ADMIN",
      req.employee.email,
      true
    );

    if (!find_s_admin || req.employee.email !== find_s_admin.email) {
      return res.status(403).send("Only Super Admin Can Have Access!!");
    }

    // find_admins
    const find_orgs = await mongoFunctions.find(
      "ORGANISATIONS",
      {},
      { createdAt: -1 }, // Sort by latest
      {
        _id: 0,
        organisation_id: 1,
        organisation_name: 1,
        organisation_details: 1,
        email: 1,
        images: 1,
        emp_count: 1,
      }
    );

    return res.status(200).send({
      orgs: find_orgs,
    });
  })
);

//universal route

router.post(
  "/universal",
  Auth,
  Async(async (req, res) => {
    // Only Super Admin can perform this
    let find_s_admin = await redis.redisGet(
      "CG_SUPER_ADMIN",
      req.employee.email,
      true
    );

    if (!find_s_admin || req.employee.email !== find_s_admin.email) {
      return res.status(403).send("Only Super Admin Can Have Access!!");
    }

    // find_admins
    const find_controls = await redisFunctions.redisGet(
      "CGHR_ADMIN_CONTROLS",
      "ADMIN_CONTROLS",
      true
    );
    //find stats
    const find_stats = await redisFunctions.redisGet(
      "CGHR_ADMIN_STATS",
      "ADMIN_STATS",
      true
    );
    //recently added orgs

    const recent_orgs = await mongoFunctions.find(
      "ORGANISATIONS",
      {},
      { createdAt: -1 },
      {
        _id: 0,
        organisation_name: 1,
        organisation_id: 1,
        images: 1,
        createdAt: 1,
      },
      5
    );

    return res.status(200).send({
      controls: find_controls,
      no_of_orgs: find_stats.no_of_orgs,
      recent_orgs: recent_orgs,
    });
  })
);

//reset password  route
router.post(
  "/reset_password",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    let data = req.body;
    //validate data
    var { error } = validations.emp_reset_password(data);
    if (error) return res.status(400).send(error.details[0].message);
    // Only Super Admin can perform this
    let find_s_admin = await redis.redisGet(
      "CG_SUPER_ADMIN",
      req.employee.email,
      true
    );

    if (!find_s_admin || req.employee.email !== find_s_admin.email) {
      return res.status(403).send("Only Super Admin Can Have Access!!");
    }

    const verifyOldPassword = await bcrypt.compare_password(
      data.old_password,
      find_s_admin.password
    );
    if (!verifyOldPassword)
      return res.status(400).send("Incorrect Old Password");
    const verifyPassword = await bcrypt.compare_password(
      data.new_password,
      find_s_admin.password
    );

    if (verifyPassword)
      return res.status(400).send("Password Should Not Same As Old Password");

    const hashedPassword = await bcrypt.hash_password(data.new_password);
    await mongoFunctions.find_one_and_update(
      "SUPER_ADMIN",
      { email: find_s_admin.email },
      { password: hashedPassword }
    );
    return res.status(200).send({
      success: "Password Reset Done Successfully",
    });
  })
);

//get profile route

router.post(
  "/get_profile",
  Auth,
  slowDown,
  Async(async (req, res) => {
    // Try to get Super Admin from Redis
    let find_super_admin = await redis.redisGet(
      "CG_SUPER_ADMIN",
      req.employee.email,
      true
    );

    // If not found in Redis, get from MongoDB
    if (!find_super_admin) {
      // console.log("hahaha");
      find_super_admin = await mongoFunctions.find_one(
        "SUPER_ADMIN",
        {
          email: req.employee.email,
        },
        { _id: 0, __v: 0, password: 0 }
      );

      // If not found in DB
      if (!find_super_admin || Object.keys(find_super_admin).length === 0) {
        return res.status(403).send("Only Super Admin Can Have Access!!");
      }

      // Update Redis
      await redisFunctions.update_redis("SUPER_ADMIN", find_super_admin);
    }

    return res.status(200).send({ profile: find_super_admin });
  })
);

module.exports = router;
