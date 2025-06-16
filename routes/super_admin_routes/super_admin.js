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

//dummy route to add super admin

router.post(
  "/add_super_admin",
  Async(async (req, res) => {
    const data = req.body;
    var { error } = validations.add_super_admin(data);
    if (error) return res.status(400).send(error.details[0].message);

    let find_super_admin = await mongoFunctions.find_one("SUPER_ADMIN", {
      email: data.email.toLowerCase(),
    });

    if (find_super_admin) {
      return res.status(400).send("Super Admin Already Exists");
    }

    const new_password = "Superadmin@1234";
    const name = "super_admin";
    let password_hash = await bcrypt.hash_password(new_password);

    let new_s_admin_data = {
      password: password_hash,

      email: data.email,
      name: name,
    };
    let new_s_admin = await mongoFunctions.create_new_record(
      "SUPER_ADMIN",
      new_s_admin_data
    );
    console.log("added super admin in database");

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
    const s_admin = await mongoFunctions.find_one("SUPER_ADMIN", {
      email: data.email.toLowerCase(),
    });
    if (!s_admin)
      return res.status(400).send("No Admin Found With The Given Email");
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
  "/add_admin",
  Async(async (req, res) => {
    const data = req.body;
    var { error } = validations.add_admin_emp(data);
    if (error) return res.status(400).send(error.details[0].message);

    let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
      "basic_info.email": data.email.toLowerCase(),
    });

    if (find_emp) {
      return res.status(400).send("Admin Already Exists");
    }
    if (
      find_emp &&
      find_emp.basic_info.email.toLowerCase() === data.email.toLowerCase()
    ) {
      return res.status(400).send("Email Id Already Exists");
    }

    const new_password = "Admin@1234";
    let password_hash = await bcrypt.hash_password(new_password);

    let new_emp_data = {
      organisation_id: functions.get_random_string("O", 5, true),
      organisation_name: "CODEGENE TECHNOLOGIES PVT LTD",
      password: password_hash,
      employee_id: data.employee_id,
      basic_info: {
        first_name: "pavan",
        last_name: "rebba",
        nick_name: "pavan sir",
        email: data.email,
      },
      work_info: {
        department_id: "D72FAFACC9E",
        department_name: "admin",
        role_id: "RD7FF12619090D2",
        role_name: "admin",
        admin_type: "1",
        designation_id: "DE2CDAC3B2C",
        designation_name: "admin",
        employment_type: "Full-time",
        employee_status: "active",
        source_of_hire: "Direct",
        reporting_manager: "",
        date_of_join: "2024-09-02",
      },
      personal_details: {
        date_of_birth: "1996-09-12",
        expertise: "everything",
        gender: "male",
        marital_status: "married",
        about_me: "jhytgfcv\n",
      },
      identity_info: {
        uan: "123456734563",
        pan: "DCUPN1233A",
        aadhaar: "987654321543",
        passport: "234567891234",
      },
      contact_details: {
        mobile_number: "9876543456",
        personal_email_address: "pavan@gmail.com",
        seating_location: "second",
        present_address: "telangana,ts",
        permanent_address: "vijayawada,ap",
      },
      work_experience: [],
      educational_details: [
        {
          institute_name: "testing",
          degree: "testing",
          specialization: "testing",
          year_of_completion: 2023,
        },
      ],
      dependent_details: [],
      leaves: [],

      images: {},
      files: {},
    };
    let new_emp = await mongoFunctions.create_new_record(
      "EMPLOYEE",
      new_emp_data
    );
    console.log("added admin in database");

    return res.status(200).send({
      success: "Success",
      // data: new_emp,
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
    let find_s_admin = await mongoFunctions.find_one("SUPER_ADMIN", {
      email: req.employee.email,
    });

    if (!find_s_admin) {
      return res.status(403).send("Only Super Admin Can Add/Update Controls!!");
    }

    // Update or insert admin controls
    const updated_controls = await mongoFunctions.find_one_and_update(
      "ADMIN_CONTROLS",
      { email: req.employee.email },
      { $set: data },
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

module.exports = router;
