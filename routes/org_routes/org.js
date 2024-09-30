const express = require("express");
const mongoFunctions = require("../../helpers/mongoFunctions");
const router = express.Router();
const validations = require("../../helpers/schema");
const bcrypt = require("../../helpers/crypto");
const jwt = require("jsonwebtoken");
const { Auth } = require("../../middlewares/auth");
const redis = require("../../helpers/redisFunctions");
const functions = require("../../helpers/functions");
const stats = require("../../helpers/stats");
const { mongo } = require("mongoose");
const Fuse = require("fuse.js");
const Async = require("../../middlewares/async");
const rateLimit = require("../../helpers/custom_rateLimiter");
const slowDown = require("../../middlewares/slow_down");
const { alertDev } = require("../../helpers/telegram");

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
      org_data_up = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        { email: req.employee.email },
        org_data,
        { new: true }
      );
      console.log("organisation details updated");
    } else {
      let new_org_data = {
        organisation_id: functions.get_random_string("O", 15, true),
        organisation_name: data.organisation_name.toUpperCase(),
        employee_id: req.employee.employee_id,
        email: req.employee.email,
        ...org_data,
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
    }
    await redis.update_redis("ORGANISATIONS", org_data_up);
    return res
      .status(200)
      .send({ success: "Organisation Details Added..!", data: org_data_up });
  })
);

router.post(
  "/add_update_department",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add update department route hit");
    let data = req.body;

    // Validate data
    var { error } = validations.add_update_department(data);
    if (error) return res.status(400).send(error.details[0].message);
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access This Endpoint");
    }
    // let org = await mongoFunctions.find_one("ORGANISATIONS", {
    //     email: req.employee.email,
    // });

    // Retrieve organisation data from Redis
    let org_data = await redis.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (org_data && org_data.organisation_id === data.organisation_id) {
      console.log("feteched org data from redis");
      // Check if department already exists
      let department_exists = org_data.departments.find(
        (e) =>
          e.department_name.toLowerCase() === data.department_name.toLowerCase()
      );

      if (department_exists) {
        return res.status(400).send("Department Already Exists..!");
      }
      const department = org_data.departments.find(
        (e) =>
          e.department_id.toLowerCase() === data.department_id.toLowerCase()
      );

      // Update or add department
      let department_data_up;

      if (data.department_id && data.department_id.length > 9) {
        if (!department) {
          return res.status(400).send("Department Id Doesn't Exists");
        }
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
        console.log("department name updated to all employees");
      } else {
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
      }

      if (department_data_up) {
        await redis.update_redis("ORGANISATIONS", department_data_up);
        console.log("updated department details in redis");
        return res.status(200).send({
          success: "Department Details Added..!",
          data: department_data_up,
        });
      }

      return res.status(400).send("Failed To Add");
    }

    return res.status(400).send("Invalid Organisation Id");
  })
);
router.post(
  "/add_update_designation",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add update designation route hit");
    let data = req.body;

    // Validate data
    var { error } = validations.add_update_designation(data);
    if (error) return res.status(400).send(error.details[0].message);
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access This Endpoint");
    }
    // org = await mongoFunctions.find_one("ORGANISATIONS", {
    //     email: req.employee.email,
    // });
    // Retrieve organisation data from Redis
    let org_data = await redis.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );

    if (org_data && org_data.organisation_id === data.organisation_id) {
      // Check if designation already exists
      console.log("designation data fetched from redis");
      let designation_exists = org_data.designations.find(
        (e) =>
          e.designation_name.toLowerCase() ===
          data.designation_name.toLowerCase()
      );

      if (designation_exists) {
        return res.status(400).send("Designation Already Exists..!");
      }
      const designation = org_data.designations.find(
        (e) =>
          e.designation_id.toLowerCase() === data.designation_id.toLowerCase()
      );

      let designation_up;

      // Update or add designation
      if (data.designation_id && data.designation_id.length > 9) {
        if (!designation) {
          return res.status(400).send("Designation Id Doesn't Exists");
        }
        designation_up = await mongoFunctions.find_one_and_update(
          "ORGANISATIONS",
          {
            organisation_id: org_data.organisation_id,
            "designations.designation_id": data.designation_id,
            // "designations.leaves.leave_id": data.leave_id
          },
          {
            $set: {
              "designations.$[des].designation_name":
                data.designation_name.toLowerCase(),
              // ""
            },
          },
          {
            arrayFilters: [
              {
                "des.designation_id": data.designation_id,
                // "des.leave.leave_id": data.leave_id
              },
            ],
            new: true,
          }
        );
        console.log("designation data updated");
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
        console.log("designation name updated to all employees");
      } else {
        let new_designation_data = {
          designation_id: functions.get_random_string("D", 10, true),
          designation_name: data.designation_name.toLowerCase(),
          // leaves:processedLeaves,
        };

        designation_up = await mongoFunctions.find_one_and_update(
          "ORGANISATIONS",
          {
            organisation_id: org_data.organisation_id,
          },
          {
            $push: {
              designations: new_designation_data,
            },
          },
          { new: true }
        );
        console.log("designation details added");
      }

      // Update Redis cache
      await redis.update_redis("ORGANISATIONS", designation_up);
      console.log("updated designation details in redis");

      return res.status(200).send({
        success: "Designation Details Added..!",
        data: designation_up,
      });
    }

    return res.status(400).send("Invalid Organisation Id");
  })
);

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
    if (req.employee.admin_type !== "1")
      return res.status(403).send("Only Director can access this endpoint");

    // org = await mongoFunctions.find_one("ORGANISATIONS", {
    //     email: req.employee.email,
    // });

    // Fetch organization data from Redis
    let org_data = await redis.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );

    // Check if organization data exists and the organization ID matches
    if (org_data && org_data.organisation_id === data.organisation_id) {
      // Check if the role already exists
      let role_exists = org_data.roles.find(
        (e) => e.role_name.toLowerCase() === data.role_name.toLowerCase()
      );
      if (role_exists) {
        return res.status(400).send("Role Already Exists..!");
      }

      let role_data_up;
      if (data.role_id && data.role_id.length > 9) {
        // Update existing role
        role_data_up = await mongoFunctions.find_one_and_update(
          "ORGANISATIONS",
          {
            organisation_id: org_data.organisation_id,
            "roles.role_id": data.role_id,
          },
          {
            $set: {
              "roles.$[r].role_name": data.role_name.toLowerCase(),
            },
          },
          {
            arrayFilters: [{ "r.role_id": data.role_id }],
            new: true,
          }
        );
        employee_data_up = await mongoFunctions.update_many(
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
      } else {
        // Add new role
        let new_role_data = {
          role_id: functions.get_random_string("R", 10, true),
          role_name: data.role_name.toLowerCase(),
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
      }

      // Update Redis with the new role data
      await redis.update_redis("ORGANISATIONS", role_data_up);

      return res.status(200).send({
        success: "Role Details Added..!",
        data: role_data_up,
      });
    }

    return res.status(400).send("Invalid Organisation id");
  })
);

router.post(
  "/universal",
  Auth,
  slowDown,
  Async(async (req, res) => {
    // let org = await mongoFunctions.find_one("ORGANISATIONS", {
    //     organisation_id: req.employee.organisation_id,
    // });
    let org_data = await redis.redisGet(
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
      { createdAt: -1 }
    );
    console.log("organisation data fetched in universal route");

    let dashborad = {
      recent_hires: recent_hires,
      birthdays: birthdays,
      organisation_details: org_data,
      reporting_managers: reporting_manager,
      employee_id: employee_id,
      today_attendance: today_attendance,
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
    const org_data = await redis.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data) {
      return res.status(400).send("Invalid Organisation Id");
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

      await redis.update_redis("ORGANISATIONS", updatedLeave);
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

      await redis.update_redis("ORGANISATIONS", updatedOrg);
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
    };
    if (roleName === "2") {
      query["work_info.admin_type"] = { $in: ["3", "4"] };
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
    };
    if (roleName === "2") {
      query["work_info.admin_type"] = { $in: ["2", "3", "4"] };
    } else if (roleName === "1") {
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
  "/add_admin_employee",
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

    const new_password = "Emp@1234";
    let password_hash = await bcrypt.hash_password(new_password);


    let new_emp_data = {
      organisation_id: "O9593",
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
        date_of_birth: "2024-09-12",
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
      educational_details: [],
      dependent_details: [],
      leaves: [
        {
          leave_id: "L43A7B58B",
          leave_name: "casual leave",
          total_leaves: 5,
          remaining_leaves: 9,
        },
        {
          leave_id: "L9CA10A6F",
          leave_name: "sick leave",
          total_leaves: 6,
          remaining_leaves: 5,
        },
        {
          leave_id: "L943CC97E",
          leave_name: "others",
          total_leaves: 5,
          remaining_leaves: 5,
        },
      ],

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

module.exports = router;
