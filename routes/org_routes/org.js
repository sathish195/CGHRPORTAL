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

router.post(
  "/add_update_org_details",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add update org details route hit");
    let data = req.body;
    const { error } = validations.add_update_org(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.admin_type !== "1")
      return res.status(403).send("Only Admin Can Access This Endpoint");

    let find_org = await mongoFunctions.find_one("ORGANISATIONS", {
      email: req.employee.email,
    });

    let org_data_up;
    let org_data = {
      email: req.employee.email,
      organisation_name: data.organisation_name.toUpperCase(),
      organisation_details: {
        organisation_type: data.organisation_type,
        org_mail_id: data.org_mail_id,
        address: data.address,
      },
      "images.logo": data.logo,
    };
    if (find_org) {
      // //restrict access
      let find_access = await functions.hasAccess(
        find_org.billing_type.type,
        "controls"
      );
      if (!find_access) {
        return res.status(400).send("Access Denied For This Feature!!");
      }
      //billing
      const updates = { ...org_data };

      // Check if billing_type update is needed
      let new_billing = data.billing_type;
      const old_billing = find_org.billing_type;

      let billingNeedsUpdate = false;

      if (
        new_billing &&
        (!old_billing ||
          old_billing.type !== new_billing.type ||
          old_billing.plan !== new_billing.plan)
      ) {
        billingNeedsUpdate = true;

        if (new_billing.type === "paid") {
          const payment_date = new Date();
          let expiry_date = new Date(payment_date);

          switch (new_billing.plan) {
            case "6_months":
              expiry_date.setMonth(expiry_date.getMonth() + 6);
              break;
            case "3_months":
              expiry_date.setMonth(expiry_date.getMonth() + 3);
              break;
            case "1_year":
              expiry_date.setFullYear(expiry_date.getFullYear() + 1);
              break;
            default:
              return res.status(400).send("Invalid billing plan.");
          }

          new_billing.payment_date = payment_date;
          new_billing.exp_date = expiry_date;
        }

        updates.billing_type = new_billing;
        console.log("Billing details updated.");
      }
      org_data_up = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        { email: req.employee.email },
        updates,
        { new: true }
      );
      console.log("organisation details updated");
    } else {
      let find_id = await mongoFunctions.find_one("ORGANISATIONS", {
        employee_id: req.employee.employee_id,
      });
      if (find_id) {
        return res
          .status(400)
          .send("Employee ID Already Exists For Another Organisation");
      }
      // 2. Set payment and expiry date
      let billing_type = data.billing_type;
      let payment_date = null;
      let expiry_date = null;

      if (billing_type.type === "paid") {
        payment_date = new Date();
        expiry_date = new Date(payment_date);

        switch (billing_type.plan) {
          case "6_months":
            expiry_date.setMonth(expiry_date.getMonth() + 6);
            break;
          case "3_months":
            expiry_date.setMonth(expiry_date.getMonth() + 3);
            break;
          case "1_year":
            expiry_date.setFullYear(expiry_date.getFullYear() + 1);
            break;
          default:
            return res.status(400).send("Invalid billing plan.");
        }
        console.log(payment_date);
        console.log(expiry_date);

        // attach dates to billing_type
        billing_type.payment_date = payment_date;
        billing_type.exp_date = expiry_date;
      }

      let new_org_data = {
        organisation_id: functions.get_random_string("O", 15, true),
        organisation_name: data.organisation_name.toUpperCase(),
        employee_id: req.employee.employee_id,
        email: req.employee.email,
        ...org_data,
        billing_type: billing_type,
        roles: [
          {
            role_id: functions.get_random_string("R", 15, true),
            role_name: "admin",
            admin_type: "1",
          },
          {
            role_id: functions.get_random_string("R", 15, true),
            role_name: "manager",
            admin_type: "2",
          },
          {
            role_id: functions.get_random_string("R", 15, true),
            role_name: "team incharge",
            admin_type: "3",
          },
          {
            role_id: functions.get_random_string("R", 15, true),
            role_name: "team member",
            admin_type: "4",
          },
        ],
      };
      org_data_up = await mongoFunctions.create_new_record(
        "ORGANISATIONS",
        new_org_data
      );
      console.log("new organisation details added");
      alertDev("new org created");
      await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        { employee_id: req.employee.employee_id },
        {
          organisation_id: org_data_up.organisation_id,
          organisation_name: org_data_up.organisation_name,
        },
        { new: true }
      );
      console.log("org id updated to admin record");
      let stats = await mongoFunctions.find_one_and_update(
        "ADMIN_STATS",
        { stats_id: "1" },
        {
          $inc: {
            no_of_orgs: 1,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
        }
      );
      console.log(stats);
      // if (!stats) {
      //   return res.status(400).send("Stats Update Failed..!!");
      // }
      await redisFunctions.update_redis("ADMIN_STATS", stats);
    }
    await redisFunctions.update_redis("ORGANISATIONS", org_data_up);

    return res
      .status(200)
      .send({ success: "Organisation Details Added..!", data: org_data_up });
  })
);
//add update department
router.post(
  "/add_update_department",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add update department route hit");
    let data = req.body;

    // ✅ Validate input
    const { error } = validations.add_update_department(data);
    if (error) return res.status(400).send(error.details[0].message);

    // ✅ Only Director or Manager can access
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access This Endpoint");
    }

    // ✅ Fetch organisation data from Redis
    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );

    if (!org_data || org_data.organisation_id !== data.organisation_id) {
      return res.status(400).send("Invalid Organisation Id");
    }

    console.log("fetched org data from redis");

    // ✅ Access control check
    let find_access = await functions.hasAccess(
      org_data.billing_type.type,
      "controls"
    );
    if (!find_access) {
      return res.status(400).send("Access Denied For This Feature!!");
    }

    // ✅ Determine if it's an update or add operation
    const isUpdate =
      data.department_id && data.department_id.toLowerCase().length > 9;

    // ✅ Department name duplicate check
    let department_exists = false;
    if (isUpdate) {
      department_exists = org_data.departments.some(
        (e) =>
          e.department_name.toLowerCase() ===
            data.department_name.toLowerCase() &&
          e.department_id.toLowerCase() !== data.department_id.toLowerCase()
      );
    } else {
      department_exists = org_data.departments.some(
        (e) =>
          e.department_name.toLowerCase() === data.department_name.toLowerCase()
      );
    }

    if (department_exists) {
      return res.status(400).send("Department Already Exists..!");
    }

    // ✅ Main update or add logic
    let department_data_up;

    if (isUpdate) {
      const current_department = org_data.departments.find(
        (e) =>
          e.department_id.toLowerCase() === data.department_id.toLowerCase()
      );
      if (!current_department) {
        return res.status(400).send("Department Id Doesn't Exist");
      }

      // ✅ Update department name in ORGANISATIONS
      department_data_up = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        {
          organisation_id: org_data.organisation_id,
          "departments.department_id": data.department_id,
        },
        {
          $set: {
            "departments.$[dep].department_name":
              data.department_name.toLowerCase(),
          },
        },
        {
          arrayFilters: [{ "dep.department_id": data.department_id }],
          new: true,
        }
      );

      console.log("department data updated");

      // ✅ Propagate name change to EMPLOYEE collection
      await mongoFunctions.update_many(
        "EMPLOYEE",
        {
          organisation_id: org_data.organisation_id,
          "work_info.department_id": data.department_id,
        },
        {
          $set: {
            "work_info.department_name": data.department_name.toLowerCase(),
          },
        }
      );

      console.log("department name updated in employees");

      await redisFunctions.update_redis("ORGANISATIONS", department_data_up);
      return res.status(200).send({
        success: "Department Updated Successfully..!",
        data: department_data_up,
      });
    } else {
      // ✅ Add new department
      let new_department_data = {
        department_id: functions.get_random_string("D", 10, true),
        department_name: data.department_name.toLowerCase(),
      };

      department_data_up = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        {
          organisation_id: org_data.organisation_id,
        },
        {
          $push: {
            departments: new_department_data,
          },
        },
        { new: true }
      );

      console.log("new department data added");

      await redisFunctions.update_redis("ORGANISATIONS", department_data_up);
      return res.status(200).send({
        success: "Department Added Successfully..!",
        data: department_data_up,
      });
    }
  })
);

// Route: Add / Update Designation
router.post(
  "/add_update_designation",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("🔁 Add/Update Designation route hit");

    let data = req.body;

    // ✅ Validate input
    const { error } = validations.add_update_designation(data);
    if (error) return res.status(400).send(error.details[0].message);

    // ✅ Only allow Director or Manager
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director or Manager can access this endpoint");
    }

    // ✅ Get Organisation Data from Redis
    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );

    if (!org_data || org_data.organisation_id !== data.organisation_id) {
      return res.status(400).send("Invalid Organisation ID");
    }

    // ✅ Check Feature Access
    const hasModuleAccess = await functions.hasAccess(
      org_data.billing_type.type,
      "controls"
    );
    if (!hasModuleAccess) {
      return res.status(403).send("Access Denied For This Feature");
    }

    // ✅ Determine if Add or Update
    const isUpdate =
      data.designation_id && data.designation_id.toString().length > 9;

    // ✅ Duplicate Check
    let isDuplicate = false;
    if (isUpdate) {
      // Check excluding current item for updates
      isDuplicate = org_data.designations.some(
        (e) =>
          e.designation_name.toLowerCase() ===
            data.designation_name.toLowerCase() &&
          e.designation_id !== data.designation_id
      );
      if (isDuplicate)
        return res
          .status(400)
          .send("Another designation with the same name already exists");
    } else {
      // Check globally for adds
      isDuplicate = org_data.designations.some(
        (e) =>
          e.designation_name.toLowerCase() ===
          data.designation_name.toLowerCase()
      );
      if (isDuplicate)
        return res.status(400).send("Designation already exists");
    }

    let updated_org;

    if (isUpdate) {
      // ✅ Update Designation Name
      updated_org = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        {
          organisation_id: org_data.organisation_id,
          "designations.designation_id": data.designation_id,
        },
        {
          $set: {
            "designations.$[d].designation_name":
              data.designation_name.toLowerCase(),
          },
        },
        {
          arrayFilters: [{ "d.designation_id": data.designation_id }],
          new: true,
        }
      );

      // ✅ Update all employees with new designation name
      await mongoFunctions.update_many(
        "EMPLOYEE",
        {
          organisation_id: org_data.organisation_id,
          "work_info.designation_id": data.designation_id,
        },
        {
          $set: {
            "work_info.designation_name": data.designation_name.toLowerCase(),
          },
        }
      );

      console.log("✅ Designation updated in employees");
    } else {
      // ✅ Add New Designation
      const new_designation = {
        designation_id: functions.get_random_string("D", 10, true),
        designation_name: data.designation_name.toLowerCase(),
      };

      updated_org = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        { organisation_id: org_data.organisation_id },
        { $push: { designations: new_designation } },
        { new: true }
      );

      console.log("✅ New designation added");
    }

    // ✅ Update Redis
    await redisFunctions.update_redis("ORGANISATIONS", updated_org);
    console.log("✅ Redis updated");

    // ✅ Final Response
    return res.status(200).send({
      message: isUpdate
        ? "Designation updated successfully"
        : "Designation added successfully",
      data: updated_org,
    });
  })
);

//add update role
router.post(
  "/add_update_role",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add update role route hit");
    let data = req.body;

    // Validate data
    const { error } = validations.add_update_role(data);
    if (error) return res.status(400).send(error.details[0].message);

    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access This Endpoint");
    }

    // Fetch organization data from Redis
    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );

    if (org_data && org_data.organisation_id === data.organisation_id) {
      // Restrict access
      let find_access = await functions.hasAccess(
        org_data.billing_type.type,
        "controls"
      );
      if (!find_access) {
        return res.status(400).send("Access Denied For This Feature!!");
      }

      let role_data_up;

      // ✅ Check if updating
      const isUpdate =
        data.role_id && data.role_id.trim() !== "" && data.role_id.length > 2;

      if (isUpdate) {
        // ✅ While updating — check if another role with same name exists
        let duplicate_role = org_data.roles.find(
          (e) =>
            e.role_name.toLowerCase() === data.role_name.toLowerCase() &&
            e.role_id !== data.role_id
        );

        if (duplicate_role) {
          return res.status(400).send("Role Already Exists..!");
        }

        // ✅ Update existing role
        role_data_up = await mongoFunctions.find_one_and_update(
          "ORGANISATIONS",
          {
            organisation_id: org_data.organisation_id,
            "roles.role_id": data.role_id,
          },
          {
            $set: {
              "roles.$[r].role_name": data.role_name.toLowerCase(),
              "roles.$[r].admin_type": data.priority,
            },
          },
          {
            arrayFilters: [{ "r.role_id": data.role_id }],
            new: true,
          }
        );

        // ✅ Also update role name in employee records
        await mongoFunctions.update_many(
          "EMPLOYEE",
          {
            organisation_id: org_data.organisation_id,
            "work_info.role_id": data.role_id,
          },
          {
            $set: {
              "work_info.role_name": data.role_name.toLowerCase(),
            },
          }
        );

        // ✅ Update Redis
        await redisFunctions.update_redis("ORGANISATIONS", role_data_up);

        return res.status(200).send({
          success: "Role Updated Successfully..!",
          data: role_data_up,
        });
      } else {
        // ✅ While adding — check for full duplicate role name
        let duplicate_role = org_data.roles.find(
          (e) => e.role_name.toLowerCase() === data.role_name.toLowerCase()
        );

        if (duplicate_role) {
          return res.status(400).send("Role Already Exists..!");
        }

        // ✅ Add new role
        let new_role_data = {
          role_id: functions.get_random_string("R", 10, true),
          role_name: data.role_name.toLowerCase(),
          admin_type: data.priority,
        };

        role_data_up = await mongoFunctions.find_one_and_update(
          "ORGANISATIONS",
          {
            organisation_id: org_data.organisation_id,
          },
          {
            $push: {
              roles: new_role_data,
            },
          },
          { new: true }
        );

        // ✅ Update Redis
        await redisFunctions.update_redis("ORGANISATIONS", role_data_up);

        return res.status(200).send({
          success: "Role Added Successfully..!",
          data: role_data_up,
        });
      }
    }

    return res.status(400).send("Invalid Organisation id");
  })
);

router.post(
  "/universal",
  Auth,
  slowDown,
  Async(async (req, res) => {
    //check admin type
    const admin_types = ["1", "2", "3"];
    if (!admin_types.includes(req.employee?.admin_type)) {
      return res.status(403).send("Access Denied!!");
    }

    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data) {
      let dashborad = {
        recent_hires: [],
        birthdays: [],
        organisation_details: [],
      };
      // await redis.update_redis("ORGANISATIONS",org_data);
      return res.status(200).send(dashborad);
    }

    // let org_data = await redis.redisGet(
    //     "CRM_ORGANISATIONS",
    //     org.organisation_id,
    //     true
    // );
    // //restrict access
    let find_access = await functions.hasAccess(
      org_data.billing_type.type,
      "dashboard"
    );
    if (!find_access) {
      return res.status(400).send("Access Denied For This Feature!!");
    }
    let recent_hires = await stats.recent_hires(req.employee.organisation_id);
    let birthdays = await stats.employees_with_birthday_today(
      req.employee.organisation_id
    );
    const projection = {
      employee_id: 1,
      "basic_info.first_name": 1,
      "basic_info.last_name": 1,
      "basic_info.email": 1,
      "work_info.role_name": 1,
    };

    let reporting_manager = await mongoFunctions.find(
      "EMPLOYEE",
      {
        organisation_id: req.employee.organisation_id,
        "work_info.employee_status": {
          $nin: [/^disable$/i, /^terminated$/i],
        },
        "work_info.admin_type": { $in: ["1", "2"] },
      },
      { _id: -1 },
      projection
    );
    const project = {
      employee_id: 1,
      _id: 0,
      // "basic_info.first_name": 1,
      // "basic_info.last_name": 1,
      // "basic_info.email": 1,
      // "work_info.role_name": 1,
    };
    const now = new Date();
    const start_day = new Date(now.setHours(0, 0, 0, 0));
    const end_day = new Date(now.setHours(23, 59, 59, 999));
    let today_attendance = await mongoFunctions.find_one(
      "ATTENDANCE",
      {
        organisation_id: req.employee.organisation_id,
        employee_id: req.employee.employee_id,
        createdAt: {
          $gte: start_day,
          $lte: end_day,
        },
      },
      { _id: 0, __v: 0 }
    );

    let employee_id = await mongoFunctions.find_one(
      "EMPLOYEE",
      {
        organisation_id: req.employee.organisation_id,
        // "work_info.admin_type": { $in: ["1", "2"] }
      }, //
      project,
      { employee_id: -1 }
    );
    console.log("organisation data fetched in universal route");
    let today = new Date();
    let tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Set to tomorrow

    let statss = await redisFunctions.redisGetAll(req.employee.employee_id);

    let total_emp_count = await mongoFunctions.count_documents("EMPLOYEE", {
      organisation_id: req.employee.organisation_id,
      "work_info.employee_status": { $regex: /^active$/i }, // Case-insensitive regex
    });
    // find_admins
    const find_controls = await redisFunctions.redisGet(
      "CGHR_ADMIN_CONTROLS",
      "ADMIN_CONTROLS",
      true
    );

    let dashborad = {
      recent_hires: recent_hires,
      birthdays: birthdays,
      organisation_details: org_data,
      reporting_managers: reporting_manager,
      employee_id: employee_id,
      today_attendance: today_attendance,
      stats: statss || {},
      total_emp_count: total_emp_count,
      admin_controls: find_controls,
    };
    // await redis.update_redis("ORGANISATIONS", org_data);
    return res.status(200).send(dashborad);
  })
);

//update leaves in a designation
router.post(
  "/add_update_leave",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add update leave route hit");
    let data = req.body;

    // Validate data
    const { error } = validations.update_leaves(data);
    if (error) return res.status(400).send(error.details[0].message);

    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access This Endpoint");
    }
    // Retrieve organisation data from Redis
    const org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data) {
      return res.status(400).send("Invalid Organisation Id");
    }
    // //restrict access
    let find_access = await functions.hasAccess(
      org_data.billing_type.type,
      "controls"
    );
    if (!find_access) {
      return res.status(400).send("Access Denied For This Feature!!");
    }

    console.log("Retrieved org_data:");

    // Check if designation exists
    const role = org_data.roles.find(
      (e) => e.role_id.toLowerCase() === data.role_id.toLowerCase()
    );

    if (!role) {
      return res.status(400).send("Role ID doesn't exist.");
    }

    // console.log("Found designation:", designation);

    // Check if leave exists
    const leave = role.leaves.find(
      (e) => e.leave_id.toLowerCase() === data.leave_id.toLowerCase()
    );

    console.log("Found leave:");

    if (data.leave_id && data.leave_id.length > 1) {
      // If leave_id is provided and valid, update the existing leave
      if (!leave) {
        return res.status(400).send("Leave ID doesn't exist.");
      }
      const leaveNameConflict = role.leaves.some(
        (e) =>
          e.leave_name.toLowerCase() === data.leave_name.toLowerCase() &&
          e.leave_id.toLowerCase() !== data.leave_id.toLowerCase()
      );

      if (leaveNameConflict) {
        return res
          .status(400)
          .send("Leave Name already exists for another leave ID.");
      }

      // Update leave
      const updatedLeave = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        {
          organisation_id: org_data.organisation_id,
          "roles.role_id": data.role_id,
          "roles.leaves.leave_id": data.leave_id,
        },
        {
          $set: {
            "roles.$[role].leaves.$[leave].leave_name": data.leave_name,
            "roles.$[role].leaves.$[leave].total_leaves": data.total_leaves,
          },
        },
        {
          arrayFilters: [
            { "role.role_id": data.role_id },
            { "leave.leave_id": data.leave_id },
          ],
          new: true,
        }
      );

      console.log("Updated leave:");

      if (!updatedLeave) {
        return res.status(404).send("Failed to update leave.");
      }

      await redisFunctions.update_redis("ORGANISATIONS", updatedLeave);
      console.log("updated leave in redis");

      const remainingLeaves = data.total_leaves - leave.total_leaves;
      let remaining = Math.max(remainingLeaves, 0);

      await mongoFunctions.update_many(
        "EMPLOYEE",
        {
          organisation_id: org_data.organisation_id,
          "work_info.role_id": data.role_id,
          "leaves.leave_id": data.leave_id,
        },
        {
          $set: {
            "leaves.$[elem].leave_name": data.leave_name,
            "leaves.$[elem].total_leaves": data.total_leaves,
          },
          $inc: {
            "leaves.$[elem].remaining_leaves": remaining, // Increment the remaining_leaves
          },
        },
        {
          arrayFilters: [{ "elem.leave_id": data.leave_id }],
        }
      );

      console.log("updated leave for all employees");

      return res.status(200).send({
        success: "Leave Updated Successfully.",
        data: updatedLeave,
      });
    } else {
      // Check if leave with the same name already exists
      const leaveExists = role.leaves.find(
        (e) => e.leave_name.toLowerCase() === data.leave_name.toLowerCase()
      );

      if (leaveExists) {
        return res.status(400).send("Leave Name Already Exists.");
      }

      // Add new leave
      const newLeave = {
        leave_id: functions.get_random_string("L", 9, true),
        leave_name: data.leave_name,
        total_leaves: data.total_leaves,
      };

      const updatedOrg = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        {
          organisation_id: org_data.organisation_id,
          "roles.role_id": data.role_id,
        },
        {
          $push: {
            "roles.$.leaves": newLeave,
          },
        },
        { new: true }
      );

      console.log("Added new leave in organisation:");

      if (!updatedOrg) {
        return res.status(404).send("Failed To Add New Leave.");
      }
      await mongoFunctions.update_many(
        "EMPLOYEE",
        {
          organisation_id: org_data.organisation_id,
          "work_info.role_id": data.role_id,
        },
        {
          $push: {
            leaves: {
              $each: [
                {
                  ...newLeave,
                  remaining_leaves: newLeave.total_leaves,
                },
              ],
            },
          },
        }
      );
      console.log("updated new leaves for all employees");

      await redisFunctions.update_redis("ORGANISATIONS", updatedOrg);
      console.log("updated new leave in redis");
      return res.status(200).send({
        success: "Leave Added Successfully.",
        data: updatedOrg,
      });
    }
  })
);

router.post(
  "/get_team_for_task",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("get team for task route hit");
    const data = req.body;
    const roleName = req.employee.admin_type;

    const query = {
      organisation_id: req.employee.organisation_id,
      employee_id: { $ne: req.employee.employee_id },
      "work_info.employee_status": { $regex: /^active$/i },
    };
    if (roleName === "2") {
      query["work_info.admin_type"] = { $in: ["2", "3", "4"] };
    } else if (roleName === "1") {
    } else if (roleName === "3") {
      query["work_info.department_id"] = req.employee.department_id;
    } else {
      return res.status(403).send("Access denied: Invalid role");
    }

    const projection = {
      employee_id: 1,
      "basic_info.first_name": 1,
      "basic_info.last_name": 1,
      "basic_info.email": 1,
      "work_info.role_name": 1,
      images: 1,
    };
    let teamMembers;

    if (data.name && data.name.length > 1) {
      const teamMembersFromDb = await mongoFunctions.find(
        "EMPLOYEE",
        query,
        { _id: -1 },
        projection
      );

      const fuse = new Fuse(teamMembersFromDb, {
        keys: ["basic_info.first_name", "basic_info.last_name"],
        threshold: 0.3,
      });

      teamMembers = fuse.search(data.name).map((result) => result.item);
    } else {
      teamMembers = await mongoFunctions.find(
        "EMPLOYEE",
        query,
        { _id: -1 },
        projection
      );
    }

    if (!teamMembers || teamMembers.length === 0) {
      return res.status(404).send("No team members found.");
    }

    res.status(200).send(teamMembers);
  })
);

//get team for attendance

router.post(
  "/get_team_for_attendance",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("get team for attendance route hit");
    const data = req.body;
    const roleName = req.employee.admin_type;

    const query = {
      organisation_id: req.employee.organisation_id,
      "work_info.employee_status": { $regex: /^active$/i },
    };
    if (roleName === "2") {
      query["work_info.admin_type"] = { $in: ["2", "3", "4"] };
    } else if (roleName === "1") {
    } else if (roleName === "3") {
      query["work_info.department_id"] = req.employee.department_id;
    } else {
      query["employee_id"] = req.employee.employee_id;
    }

    const projection = {
      _id: 0,
      employee_id: 1,
      "basic_info.first_name": 1,
      "basic_info.last_name": 1,
      "basic_info.email": 1,
      "work_info.role_name": 1,
      images: 1,
    };
    let teamMembers;

    if (data.name && data.name.length > 1) {
      const teamMembersFromDb = await mongoFunctions.find(
        "EMPLOYEE",
        query,
        { _id: -1 },
        projection
      );

      const fuse = new Fuse(teamMembersFromDb, {
        keys: ["basic_info.first_name", "basic_info.last_name"],
        threshold: 0.3,
      });

      teamMembers = fuse.search(data.name).map((result) => result.item);
    } else {
      teamMembers = await mongoFunctions.find(
        "EMPLOYEE",
        query,
        { _id: -1 },
        projection
      );
    }

    if (!teamMembers || teamMembers.length === 0) {
      return res.status(404).send("No team members found.");
    }

    res.status(200).send(teamMembers);
  })
);

router.post(
  "/get_team_for_project",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("get team for project route hit");
    const roleName = req.employee.admin_type;
    const query = {
      organisation_id: req.employee.organisation_id,
      employee_id: { $ne: req.employee.employee_id },
      "work_info.employee_status": { $regex: /^active$/i },
    };

    if (roleName === "1") {
      query["work_info.admin_type"] = { $in: ["3", "2"] };
    } else if (roleName === "2") {
      query["work_info.admin_type"] = "3";
      // No additional conditions for 'manager' or 'team incharge'
    } else {
      return res.status(403).send("Access denied: Invalid role");
    }

    const projection = {
      employee_id: 1,
      "basic_info.first_name": 1,
      "basic_info.last_name": 1,
      "basic_info.email": 1,
      "work_info.role_name": 1,
    };

    const teamMembers = await mongoFunctions.find(
      "EMPLOYEE",
      query,
      { _id: -1 },
      projection
    );

    if (!teamMembers || teamMembers.length === 0) {
      return res.status(404).send("No team members found.");
    }

    res.status(200).json(teamMembers);
  })
);

router.post(
  "/update_token",
  Auth,
  Async(async (req, res) => {
    console.log("update token route hit");

    const org_id = await mongoFunctions.find_one("ORGANISATIONS", {
      email: req.employee.email,
    });
    if (!org_id) return res.status(404).send("Organisation not found");
    // //restrict access
    let find_access = await functions.hasAccess(
      org_id.billing_type.type,
      "controls"
    );
    if (!find_access) {
      return res.status(400).send("Access Denied For This Feature!!");
    }

    const token = jwt.sign(
      {
        organisation_id: org_id.organisation_id,
        employee_id: req.employee.employee_id,
        first_name: req.employee.first_name,
        last_name: req.employee.last_name,
        email: req.employee.email,
        department_id: req.employee.department_id,
        designation_id: req.employee.designation_id,
        designation_name: req.employee.designation_name,
        role_id: req.employee.role_id,
        role_name: req.employee.role_name,
        admin_type: req.employee.admin_type,
        two_fa_status: req.employee.two_fa_status,
        status: req.employee.employee_status,
        collection: "EMPLOYEE",
      },
      process.env.jwtPrivateKey,
      { expiresIn: "90d" }
    );
    console.log("updated token");

    return res.status(200).send({
      success: token,
    });
  })
);

router.post(
  "/add_admin",
  Async(async (req, res) => {
    console.log("add admin employee route hit");

    const data = req.body;
    var { error } = validations.add_admin_emp(data);
    if (error) return res.status(400).send(error.details[0].message);

    let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
      $or: [
        {
          employee_id: data.employee_id.toUpperCase(),
        },
        {
          "basic_info.email": data.email.toLowerCase(),
        },
      ],
    });

    if (
      find_emp &&
      find_emp.employee_id.toUpperCase() === data.employee_id.toUpperCase()
    ) {
      return res.status(400).send("Employee Id Already Exists");
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

//add update holiday
router.post(
  "/add_update_holiday",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add update holiday route hit");

    // Validate data
    const { error, value } = validations.add_holidays(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const data = value;
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access This Endpoint");
    }

    // Retrieve organisation data from Redis
    const org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data || org_data.organisation_id !== data.organisation_id) {
      return res.status(400).send("Invalid Organisation Id");
    }

    // Restrict feature access based on billing_type
    const hasFeatureAccess = await functions.hasAccess(
      org_data.billing_type.type,
      "controls"
    );
    if (!hasFeatureAccess) {
      return res.status(400).send("Access Denied For This Feature!!");
    }

    let holiday_data;

    if (data.holiday_id && data.holiday_id.length > 9) {
      // 🔄 UPDATE Holiday

      holiday_data = await mongoFunctions.find_one("HOLIDAYS", {
        organisation_id: org_data.organisation_id,
        holiday_id: data.holiday_id,
      });

      if (!holiday_data) {
        return res.status(400).send("Holiday Id Doesn't Exist");
      }

      // ✅ Check for duplicates (excluding current record)
      const holiday_exists = await mongoFunctions.find_one("HOLIDAYS", {
        organisation_id: req.employee.organisation_id,
        $or: [
          {
            holiday_name: data.holiday_name.toLowerCase(),
            holiday_id: { $ne: data.holiday_id },
          },
          {
            holiday_date: data.holiday_date,
            holiday_id: { $ne: data.holiday_id },
          },
        ],
      });

      if (holiday_exists) {
        if (
          holiday_exists.holiday_date.getTime() ===
          new Date(data.holiday_date).getTime()
        ) {
          return res
            .status(400)
            .send("Holiday With This Date Already Exists..!");
        }

        if (holiday_exists.holiday_name === data.holiday_name.toLowerCase()) {
          return res
            .status(400)
            .send("Holiday With This Name Already Exists..!");
        }
      }

      // ✅ Proceed to update
      holiday_data = await mongoFunctions.find_one_and_update(
        "HOLIDAYS",
        {
          organisation_id: org_data.organisation_id,
          holiday_id: data.holiday_id,
        },
        {
          $set: {
            holiday_name: data.holiday_name.toLowerCase(),
            holiday_date: data.holiday_date,
          },
          $push: {
            modified_by: {
              employee_id: req.employee.employee_id,
              employee_name: `${req.employee.first_name} ${req.employee.last_name}`,
              employee_email: req.employee.email,
            },
          },
        }
      );

      return res.status(200).send({
        success: "Holiday Details Updated Successfully!",
        data: holiday_data,
      });
    } else {
      // ➕ ADD new Holiday

      // ✅ Check for any duplicate name or date
      const holiday_exists = await mongoFunctions.find_one("HOLIDAYS", {
        organisation_id: req.employee.organisation_id,
        $or: [
          { holiday_name: data.holiday_name.toLowerCase() },
          { holiday_date: data.holiday_date },
        ],
      });

      if (holiday_exists) {
        if (
          holiday_exists.holiday_date.getTime() ===
          new Date(data.holiday_date).getTime()
        ) {
          return res
            .status(400)
            .send("Holiday With This Date Already Exists..!");
        }

        if (holiday_exists.holiday_name === data.holiday_name.toLowerCase()) {
          return res
            .status(400)
            .send("Holiday With This Name Already Exists..!");
        }
      }

      const new_holiday_data = {
        organisation_id: req.employee.organisation_id,
        holiday_id: functions.get_random_string("H", 10, true),
        holiday_name: data.holiday_name.toLowerCase(),
        holiday_date: data.holiday_date,
        added_by: {
          employee_id: req.employee.employee_id,
          employee_name: `${req.employee.first_name} ${req.employee.last_name}`,
          email: req.employee.email,
        },
      };

      holiday_data = await mongoFunctions.create_new_record(
        "HOLIDAYS",
        new_holiday_data
      );

      return res.status(200).send({
        success: "Holiday Details Added Successfully!",
        data: holiday_data,
      });
    }
  })
);

router.post(
  "/get_holidays_list",
  Auth,
  slowDown,
  Async(async (req, res) => {
    const admin_types = ["1", "2", "3", "4"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access Holidays List");
    }
    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data) {
      return res.status(400).send("Organisation Not Found!!");
    }
    // //restrict access
    let find_access = await functions.hasAccess(
      org_data.billing_type.type,
      "controls"
    );
    if (!find_access) {
      return res.status(400).send("Access Denied For This Feature!!");
    }
    const h_list = await mongoFunctions.find(
      "HOLIDAYS",
      { organisation_id: req.employee.organisation_id },
      { holiday_date: 1 },
      { _id: 0, __v: 0 }
    );
    return res.status(200).send(h_list);
  })
);

const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.post(
  "/upload_pdf_file",
  Auth,
  upload.single("Files"),
  Async(async (req, res) => {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }
    console.log(req.file.size);
    // Check if file is within size limit
    if (req.file.size > 1 * 1024 * 1024) {
      return res.status(400).send("File size must be between 1 MB and 2 MB.");
    }

    const base64_string = req.file.buffer.toString("base64");
    file_data = {
      file_id: functions.get_random_string("F", 9, true),
      file: base64_string,
      organisation_id: req.employee.organisation_id,
    };
    // await mongoFunctions.create_new_record("FILES", file_data);

    res.send({ message: "File uploaded successfully!", base64: base64_string });
  })
);
router.post(
  "/get_attendance_stats",
  Auth,
  Async(async (req, res) => {
    const now = new Date();
    let start_day, end_day;
    // Validate data
    const { error, value } = validations.get_attendance_stats(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const data = value;
    //find org
    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data) {
      return res.status(400).send("Organisation Not Found!!");
    }
    // //restrict access
    let find_access = await functions.hasAccess(
      org_data.billing_type.type,
      "today_attendance"
    );
    if (!find_access) {
      return res.status(400).send("Access Denied For This Feature!!");
    }

    // Check if a date is provided in the request
    if (data.date) {
      const providedDate = new Date(data.date);
      start_day = new Date(providedDate.setHours(0, 0, 0, 0));
      end_day = new Date(providedDate.setHours(23, 59, 59, 999));
    } else {
      start_day = new Date(now.setHours(0, 0, 0, 0));
      end_day = new Date(now.setHours(23, 59, 59, 999));
    }

    let present = await mongoFunctions.find(
      "ATTENDANCE",
      {
        organisation_id: req.employee.organisation_id,
        createdAt: {
          $gte: start_day,
          $lte: end_day,
        },
        status: { $in: ["checkin", "checkout"] },
        attendance_status: {
          $in: ["present", "0.5 day present, 0.5 day absent", "", "half day"],
        },
      },

      { createdAt: -1 },
      { _id: 0, __v: 0 }
    );
    let absent = await mongoFunctions.find(
      "ATTENDANCE",
      {
        organisation_id: req.employee.organisation_id,
        createdAt: {
          $gte: start_day,
          $lte: end_day,
        },
        attendance_status: "absent",
      },
      { createdAt: -1 },
      { _id: 0, __v: 0 }
    );

    let leave = await mongoFunctions.find(
      "ATTENDANCE",
      {
        organisation_id: req.employee.organisation_id,
        createdAt: {
          $gte: start_day,
          $lte: end_day,
        },
        status: "leave",
      },
      { createdAt: -1 },
      { _id: 0, __v: 0 }
    );

    return res.status(200).send({ present, leave, absent });
  })
);

router.post(
  "/delete_holiday",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const { error, value } = validations.delete_data(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const data = value;
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access This Endpoint");
    }
    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data) {
      return res.status(400).send("Organisation Not Found!!");
    }
    // //restrict access
    let find_access = await functions.hasAccess(
      org_data.billing_type.type,
      "controls"
    );
    if (!find_access) {
      return res.status(400).send("Access Denied For This Feature!!");
    }

    let findId = await mongoFunctions.find_one("HOLIDAYS", {
      organisation_id: req.employee.organisation_id,
      holiday_id: data.id,
    });
    if (!findId) {
      return res.status(400).send("Holiday Doesn't Exists");
    }
    let removeId = await mongoFunctions.find_one_and_delete("HOLIDAYS", {
      organisation_id: req.employee.organisation_id,
      holiday_id: data.id,
    });
    return res.status(200).send("Holiday Removed Successfully..!");
  })
);
router.post(
  "/delete_stats",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const { error, value } = validations.delete_data(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const data = value;
    await redis.del_task_status(data.id);
    return res.status(200).send("success");
  })
);
router.post(
  "/mongo_backup",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const success = await functions.mongoBackup();
    if (!success) {
      return res.status(500).send("❌ Mongo backup failed");
    }

    console.log("✅ Backup done.. Entering zipping phase");

    const dumpFolderPath = path.join(process.cwd(), "dump");
    const zipFilePath = path.join(process.cwd(), "dump.zip");
    try {
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", resolve);
        archive.on("error", reject);

        archive.pipe(output);
        archive.directory(dumpFolderPath, false);
        archive.finalize();
      });

      console.log("✅ Zip created. Starting download...");

      res.download(zipFilePath, "mongo_backup.zip", async (err) => {
        if (err) {
          console.error("❌ Download error:", err);
          return res.status(500).send("Download failed");
        }

        try {
          await fsp.unlink(zipFilePath);
          console.log("✅ Zip file deleted after download.");
        } catch (unlinkErr) {
          console.error("❌ Error deleting zip:", unlinkErr);
        }
      });
    } catch (zipErr) {
      console.error("❌ Archiving error:", zipErr);
      res.status(500).send("Archiving error");
    }
  })
);

router.post(
  "/mongo_restore",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    let r = await functions.mongoRestore();
    if (r) {
      return res.status(200).send("Restore Done sucecssfully..!!");
    }
    return res.status(400).send("Restore Failed..!");
  })
);
router.post(
  "/set_universal_data",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    let org = await mongoFunctions.find_one("ORGANISATIONS", {
      organisation_id: req.employee.organisation_id,
    });
    await redis.update_redis("ORGANISATIONS", org);
    return res
      .status(200)
      .send("Universal data stored in redis successfully..!");
  })
);
//mongo backup test
const { exec } = require("child_process");
//Using zip command and there are 2 other ways...Node-7z and tar-gz
router.post(
  "/mongo_backup_test",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const success = await functions.mongoBackup();
    if (!success) {
      return res.status(500).send(":x: Mongo backup failed");
    }

    console.log(":white_check_mark: Backup done.. Entering zipping phase");

    const dumpFolderPath = path.join(process.cwd(), "dump");
    const zipFilePath = path.join(process.cwd(), "mongo_backup.zip");
    const zipPassword = process.env.ZIP_PASSWORD;

    // Use zip CLI to create password-protected archive
    const zipCommand = `cd "${process.cwd()}" && zip -r -P "${zipPassword}" "${zipFilePath}" dump`;

    exec(zipCommand, async (err, stdout, stderr) => {
      if (err) {
        console.error(":x: Error creating zip:", stderr || err.message);
        return res.status(500).send("Archiving error");
      }

      console.log(":white_check_mark: Zip created. Starting download...");

      res.download(zipFilePath, "mongo_backup.zip", async (err) => {
        if (err) {
          console.error(":x: Download error:", err);
          return res.status(500).send("Download failed");
        }

        try {
          await fsp.unlink(zipFilePath);
          console.log(":white_check_mark: Zip file deleted after download.");
        } catch (unlinkErr) {
          console.error(":x: Error deleting zip:", unlinkErr);
        }
      });
    });
  })
);

module.exports = router;
