const express = require("express");
const mongoFunctions = require("../../helpers/mongoFunctions");
const router = express.Router();
const validations = require("../../helpers/schema");
const bcrypt = require("../../helpers/crypto");
const jwt = require("jsonwebtoken");
const { Auth } = require("../../middlewares/auth");
const redisFunctions = require("../../helpers/redisFunctions");
const stats = require("../../helpers/stats");
const functions = require("../../helpers/functions");
const { date, func } = require("joi");
const { RFC_2822 } = require("moment");
const Async = require("../../middlewares/async");
const rateLimit = require("../../helpers/custom_rateLimiter");
const moment = require("moment-timezone");
const Nodemailer = require("nodemailer");
const slowDown = require("../../middlewares/slow_down");
const Fuse = require("fuse.js");

//forgot password  route to reset employee's forgot password
router.post(
  "/emp_reset_password",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("employee reset password by admin route hit");
    let data = req.body;
    var { error } = validations.emp_reset_password_by_admin(data);
    if (error) return res.status(400).send(error.details[0].message);
    //validate data
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Admin Or Manager Can Access This Endpoint");
    }

    const employee = await mongoFunctions.find_one("EMPLOYEE", {
      "basic_info.email": data.email.toLowerCase(),
    });
    if (!employee)
      return res.status(400).send("No Employee Found With The Given Email");

    if (
      // employee &&
      employee.work_info.employee_status.toLowerCase() === "disable" ||
      employee.work_info.employee_status.toLowerCase() === "terminated"
    )
      return res.status(400).send("Employee Status Disabled!");
    const verifyPassword = bcrypt.compare_password(
      data.new_password,
      employee.password
    );
    console.log(verifyPassword);
    console.log(employee.password);
    console.log(data.new_password);
    if (verifyPassword)
      return res
        .status(400)
        .send("Password Should Not Same As Your Old Password");
    const hashedPassword = bcrypt.hash_password(data.new_password);
    await mongoFunctions.find_one_and_update(
      "EMPLOYEE",
      { employee_id: employee.employee_id },
      { password: hashedPassword }
    );
    return res.status(200).send({
      success: "Password Reset Done Successfully",
    });
  })
);
// Add new employee

router.post(
  "/add_employee",
  Auth,
  Async(async (req, res) => {
    console.log("add employee route hit");
    let data = req.body;
    var { error } = validations.add_employee_by_admin(data);
    if (error) return res.status(400).send(error.details[0].message);
    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data) return res.status(400).send("Access Denied..!");
    // //restrict access
    let find_access = await functions.hasAccess(
      org_data.billing_type.type,
      "add_employee"
    );
    if (!find_access) {
      return res.status(400).send("Access Denied For This Feature!!");
    }
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res.status(403).send("Only Admin Or Manager Can Add New Employee");
    }

    let department_data = org_data.departments.find(
      (e) => e.department_id === data.department_id
    );
    if (!department_data)
      return res.status(400).send("Invalid Department id..!");

    let role_data = org_data.roles.find((e) => e.role_id === data.role_id);
    if (!role_data) return res.status(400).send("Invalid Role id..!");

    let designation_data = org_data.designations.find(
      (e) => e.designation_id === data.designation_id
    );
    if (!designation_data)
      return res.status(400).send("Invalid Designation id..!");

    employees = await mongoFunctions.find("EMPLOYEE", {
      organisation_id: req.employee.organisation_id,
    });
    //
    if (employees.length < 2 && role_data.admin_type !== "2") {
      return res
        .status(400)
        .send(
          "Director Must Have Added At Least One Manager Before Adding Another Employee."
        );
    }

    // Check if the current admin is a Manager
    if (req.employee.admin_type === "2" && role_data.admin_type === "2") {
      // Managers cannot add other Managers
      if (data.role_id === role_data.role_id) {
        return res.status(400).send("A Manager Cannot Add Another Manager.");
      }
    }
    if (
      !Array.isArray(data.educational_details) ||
      data.educational_details.length === 0
    ) {
      return res.status(400).send("Educational Details Must be Filled");
    }
    // let repo = await mongoFunctions.find_one("EMPLOYEE", {
    //   organisation_id: req.employee.organisation_id,
    //   employee_id: data.reporting_manager,
    // });
    // // if (repo) {
    // //   emp.work_info.reporting_manager =
    // //     repo.basic_info.first_name + " " + repo.basic_info.last_name;
    // // }
    // if (!repo) return res.status(400).send("Reporting Manager Not Found..!");
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
      find_emp.basic_info.email &&
      find_emp.basic_info.email.toLowerCase() ===
        data.email.toLowerCase().trim()
    ) {
      return res.status(400).send("Email Id Already Exists");
    }

    // Assuming mongoFunctions is properly imported and set up

    let find_adhar = await mongoFunctions.find_one("EMPLOYEE", {
      $or: [
        {
          "contact_details.personal_email_address":
            data.personal_email_address.toLowerCase(),
        },

        {
          "identity_info.pan": data.identity_info.pan,
        },
        {
          "identity_info.aadhaar": data.identity_info.aadhaar,
        },
        {
          "identity_info.uan": data.identity_info.uan,
        },
        {
          "identity_info.passport": data.identity_info.passport_number,
        },
        {
          "contact_details.mobile_number": data.mobile_number,
        },
      ],
    });
    if (find_adhar) {
      // Check for duplicate personal email address in contact_details
      if (
        find_adhar.contact_details.personal_email_address &&
        find_adhar.contact_details.personal_email_address.toLowerCase() ===
          data.personal_email_address.toLowerCase().trim()
      ) {
        return res.status(400).send("Personal Email Id Already Exists");
      }

      if (
        find_adhar.identity_info.aadhaar &&
        find_adhar.identity_info.aadhaar.length > 0 &&
        find_adhar.identity_info.aadhaar === data.identity_info.aadhaar
      ) {
        return res.status(400).send("Aadhar Number Already Exists");
      }
      if (
        find_adhar.identity_info.uan &&
        find_adhar.identity_info.uan.length > 0 &&
        find_adhar.identity_info.uan === data.identity_info.uan
      ) {
        return res.status(400).send("Uan Number Already Exists");
      }

      if (
        find_adhar.identity_info.passport_number &&
        find_adhar.identity_info.passport_number.length > 0 &&
        find_adhar.identity_info.passport_number ===
          data.identity_info.passport_number
      ) {
        return res.status(400).send("Passport Number Already Exists");
      }

      if (
        find_adhar.contact_details.mobile_number &&
        find_adhar.contact_details.mobile_number.length > 0 &&
        find_adhar.contact_details.mobile_number === data.mobile_number
      ) {
        return res.status(400).send("Mobile Number Already Exists");
      }

      if (
        find_adhar.identity_info.pan &&
        find_adhar.identity_info.pan.length > 0 &&
        find_adhar.identity_info.pan === data.identity_info.pan
      ) {
        return res.status(400).send("PAN Number Already Exists");
      }
    }
    const new_password = data.password;
    let password_hash = await bcrypt.hash_password(new_password);
    let new_emp_data = {
      organisation_id: org_data.organisation_id,
      organisation_name: org_data.organisation_name,
      employee_id: data.employee_id.toUpperCase(),
      password: password_hash,
      basic_info: {
        first_name: data.first_name,
        last_name: data.last_name,
        nick_name: data.nick_name,
        email: data.email.toLowerCase(),
      },
      work_info: {
        department_id: data.department_id,
        department_name: department_data.department_name,

        role_id: data.role_id,
        role_name: role_data.role_name,
        admin_type: role_data.admin_type,

        designation_id: data.designation_id,
        designation_name: designation_data.designation_name,
        employment_type: data.employment_type,
        employee_status: data.employee_status,
        source_of_hire: data.source_of_hire,
        reporting_manager: data.reporting_manager,
        date_of_join: data.date_of_join,
      },

      personal_details: {
        date_of_birth: data.date_of_birth,
        expertise: data.expertise,
        gender: data.gender,
        marital_status: data.marital_status,
        about_me: data.about_me,
      },
      identity_info: data.identity_info,
      contact_details: {
        // work_phone_number: data.work_phone_number,
        mobile_number: data.mobile_number,
        personal_email_address: data.personal_email_address.toLowerCase(),
        seating_location: data.seating_location,
        present_address: data.present_address,
        permanent_address: data.permanent_address,
      },
      work_experience: data.work_experience,
      educational_details: data.educational_details,
      dependent_details: data.dependent_details,
      leaves:
        role_data.leaves && role_data.leaves.length > 0
          ? role_data.leaves.map((e) => ({
              ...e,
              used_leaves: 0,
              remaining_leaves: e.total_leaves,
            }))
          : [],
      images: {},
      files: {},
    };
    let new_emp = await mongoFunctions.create_new_record(
      "EMPLOYEE",
      new_emp_data
    );
    if (!new_emp) {
      return res.status(400).send("Failed To Add New Employee.");
    }
    //update stats
    if (new_emp_data.work_info.employee_status.toLowerCase() === "active") {
      let update_emp_count = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        { organisation_id: data.organisation_id },
        { $inc: { emp_count: 1 } },
        { returnDocument: "after" }
      );
      await redisFunctions.update_redis("ORGANISATIONS", update_emp_count);
    }

    // await redis.update_redis("EMPLOYEE", new_emp);
    // console.log("added emp in redis");
    //   await stats.update_emp(new_emp, true, true);
    return res.status(200).send({
      success: "Employee Added Successfully..!!",
      // data: new_emp,
    });
  })
);

// Update employee profile
router.post(
  "/update_employee_profile",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("update employee profile by admin route hit");
    console.log(req.data);
    var { error, value } = validations.add_employee_by_admin(req.body);
    let data = value;

    if (error) return res.status(400).send(error.details[0].message);
    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data) return res.status(400).send("Access Denied..!");
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Admin Or Manager Can Update Employee Profile");
    }
    let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
      employee_id: data.employee_id.toUpperCase(),
    });
    if (!find_emp) {
      return res.status(400).send("Employee Id Doesn't Exists");
    }

    let department_data = org_data.departments.find(
      (e) => e.department_id === data.department_id
    );
    if (!department_data)
      return res.status(400).send("Invalid Department id..!");

    let role_data = org_data.roles.find((e) => e.role_id === data.role_id);
    if (!role_data) return res.status(400).send("Invalid Role id..!");

    let designation_data = org_data.designations.find(
      (e) => e.designation_id === data.designation_id
    );
    if (!designation_data)
      return res.status(400).send("Invalid Designation id..!");
    if (req.employee.admin_type === "2" && role_data.admin_type === "2") {
      // Managers cannot add other Managers
      if (data.role_id === role_data.role_id) {
        return res.status(400).send("A Manager Cannot Update Another Manager.");
      }
    }

    if (
      !Array.isArray(data.educational_details) ||
      data.educational_details.length === 0
    ) {
      return res.status(400).send("Educational Details Must be Filled");
    }
    // let repo = await mongoFunctions.find_one("EMPLOYEE", {
    //   organisation_id: req.employee.organisation_id,
    //   employee_id: data.reporting_manager,
    // });
    // // if (repo) {
    // //   emp.work_info.reporting_manager =
    // //     repo.basic_info.first_name + " " + repo.basic_info.last_name;
    // // }
    // if (!repo) return res.status(400).send("Reporting Manager Not Found..!");
    let find_adhar = await mongoFunctions.find_one("EMPLOYEE", {
      $or: [
        {
          "basic_info.email": data.email.toLowerCase(),
          employee_id: { $ne: data.employee_id },
        },
        {
          "contact_details.personal_email_address":
            data.personal_email_address.toLowerCase(),
          employee_id: { $ne: data.employee_id },
        },

        {
          "identity_info.pan": data.identity_info.pan,
          employee_id: { $ne: data.employee_id },
        },
        {
          "identity_info.aadhaar": data.identity_info.aadhaar,
          employee_id: { $ne: data.employee_id },
        },
        {
          "identity_info.uan": data.identity_info.uan,
          employee_id: { $ne: data.employee_id },
        },
        {
          "identity_info.passport_number": data.identity_info.passport_number,
          employee_id: { $ne: data.employee_id },
        },
        {
          "contact_details.mobile_number": data.mobile_number,
          employee_id: { $ne: data.employee_id },
        },
      ],
    });
    if (find_adhar) {
      if (
        find_adhar.basic_info.email &&
        find_adhar.basic_info.email.toLowerCase() ===
          data.email.toLowerCase().trim()
      ) {
        return res.status(400).send("Email Id Already Exists");
      }

      // Check for duplicate personal email address in contact_details
      if (
        find_adhar.contact_details.personal_email_address &&
        find_adhar.contact_details.personal_email_address.toLowerCase() ===
          data.personal_email_address.toLowerCase().trim()
      ) {
        return res.status(400).send("Personal Email Id Already Exists");
      }

      if (
        find_adhar.identity_info.aadhaar &&
        find_adhar.identity_info.aadhaar.length > 0 &&
        find_adhar.identity_info.aadhaar === data.identity_info.aadhaar
      ) {
        return res.status(400).send("Aadhar Number Already Exists");
      }
      if (
        find_adhar.identity_info.uan &&
        find_adhar.identity_info.uan.length > 0 &&
        find_adhar.identity_info.uan === data.identity_info.uan
      ) {
        return res.status(400).send("Uan Number Already Exists");
      }

      if (
        find_adhar.identity_info.passport_number &&
        find_adhar.identity_info.passport_number.length > 0 &&
        find_adhar.identity_info.passport_number ===
          data.identity_info.passport_number
      ) {
        return res.status(400).send("Passport Number Already Exists");
      }

      if (
        find_adhar.contact_details.mobile_number &&
        find_adhar.contact_details.mobile_number.length > 0 &&
        find_adhar.contact_details.mobile_number === data.mobile_number
      ) {
        return res.status(400).send("Mobile Number Already Exists");
      }

      if (
        find_adhar.identity_info.pan &&
        find_adhar.identity_info.pan.length > 0 &&
        find_adhar.identity_info.pan === data.identity_info.pan
      ) {
        return res.status(400).send("PAN Number Already Exists");
      }
    }

    let new_emp_data = {
      organisation_id: org_data.organisation_id,
      organisation_name: org_data.organisation_name,
      employee_id: data.employee_id.toUpperCase(),
      basic_info: {
        first_name: data.first_name,
        last_name: data.last_name,
        nick_name: data.nick_name,
        email: data.email.toLowerCase(),
      },
      work_info: {
        department_id: data.department_id,
        department_name: department_data.department_name,

        role_id: data.role_id,
        role_name: role_data.role_name,
        admin_type: role_data.admin_type,

        designation_id: data.designation_id,
        designation_name: designation_data.designation_name,
        employment_type: data.employment_type,
        employee_status: data.employee_status,
        source_of_hire: data.source_of_hire,
        reporting_manager: data.reporting_manager,
        date_of_join: data.date_of_join,
      },

      personal_details: {
        date_of_birth: data.date_of_birth,
        expertise: data.expertise,
        gender: data.gender,
        marital_status: data.marital_status,
        about_me: data.about_me,
      },
      identity_info: data.identity_info,
      contact_details: {
        // work_phone_number: data.work_phone_number,
        mobile_number: data.mobile_number,
        personal_email_address: data.personal_email_address.toLowerCase(),
        seating_location: data.seating_location,
        present_address: data.present_address,
        permanent_address: data.permanent_address,
      },
      work_experience: data.work_experience,
      educational_details: data.educational_details,
      dependent_details: data.dependent_details,
      leaves:
        role_data.role_id !== data.role_id && role_data.leaves.length > 0
          ? role_data.leaves.map((e) => ({
              ...e,
              used_leaves: 0,
              remaining_leaves: e.total_leaves,
            }))
          : find_emp.leaves,
    };
    console.log(find_emp.leaves);
    let new_emp = await mongoFunctions.find_one_and_update(
      "EMPLOYEE",
      { employee_id: data.employee_id },
      { $set: new_emp_data }
    );
    //update stats
    if (
      find_emp.work_info.employee_status.toLowerCase() === "active" &&
      (new_emp_data.work_info.employee_status.toLowerCase() === "disable" ||
        new_emp_data.work_info.employee_status.toLowerCase() === "terminated")
    ) {
      let update_emp_count = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        { organisation_id: data.organisation_id },
        { $inc: { emp_count: -1 } },
        { returnDocument: "after" }
      );
      await redisFunctions.update_redis("ORGANISATIONS", update_emp_count);
    }
    if (
      (find_emp.work_info.employee_status.toLowerCase() === "disable" ||
        find_emp.work_info.employee_status.toLowerCase() === "terminated") &&
      new_emp_data.work_info.employee_status.toLowerCase() === "active"
    ) {
      let update_emp_count = await mongoFunctions.find_one_and_update(
        "ORGANISATIONS",
        { organisation_id: data.organisation_id },
        { $inc: { emp_count: 1 } },
        { returnDocument: "after" }
      );
      await redisFunctions.update_redis("ORGANISATIONS", update_emp_count);
    }

    // await redis.update_redis("EMPLOYEE", new_emp);
    // console.log("updated emp in redis");
    //   await stats.update_emp(new_emp, true, true);
    return res.status(200).send({
      success: "Employee Profile Updated Successfully..!",
      // data: new_emp,
    });
  })
);

router.post(
  "/add_update_project",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add update project route hit");

    // Validate request data
    const { error, value } = validations.add_project(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    let data = value;

    // Check user role
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res.status(403).send("Access denied: Not Admin or Manager");
    }

    if (data.project_id && data.project_id.length > 9) {
      // Check if project ID exists
      const findId = await mongoFunctions.find_one("PROJECTS", {
        organisation_id: req.employee.organisation_id,
        project_id: data.project_id,
      });

      if (!findId) return res.status(400).send("Project ID Does Not Exist");

      // Update project
      let project_data_up = await mongoFunctions.find_one_and_update(
        "PROJECTS",
        {
          organisation_id: req.employee.organisation_id,
          project_id: data.project_id,
        },
        {
          $set: {
            start_date: data.start_date,
            project_name: data.project_name.toLowerCase(),
            end_date: data.end_date,
            status: data.status,
            description: data.description,
            project_status: data.project_status,
          },
          $push: {
            modified_by: {
              employee_id: req.employee.employee_id,
              employee_name:
                req.employee.first_name + " " + req.employee.last_name,
              employee_email: req.employee.email,
              modifiedAt: new Date(),
              prevStatus: findId.status,
              currentStatus: data.status,
            },
          },
        },
        { new: true } // Optionally return the updated document
      );
      console.log("project details updated");

      if (!project_data_up)
        return res.status(400).send("Project Update Failed");
      await mongoFunctions.update_many(
        "TASKS",
        { project_id: data.project_id },
        { $set: { project_name: data.project_name } }
      );
      if (project_data_up.project_status.toLowerCase() === "in_active") {
        await mongoFunctions.update_many(
          "TASKS",
          { project_id: data.project_id },
          { $set: { task_status: "in_active" } }
        );
      }
      return res.status(200).send("Project Updated Successfully");
    } else {
      // Check if project name already exists
      const findProject = await mongoFunctions.find_one("PROJECTS", {
        organisation_id: req.employee.organisation_id,
        project_name: data.project_name.toLowerCase(),
      });

      if (findProject)
        return res.status(400).send("Project Name Already Exists");

      const new_project_data = {
        organisation_id: req.employee.organisation_id,
        project_id: functions.get_random_string("PR", 9, true),
        project_name: data.project_name.toLowerCase(),
        start_date: data.start_date,
        end_date: data.end_date,
        description: data.description,
        status: data.status,
        project_status: data.project_status,
        created_by: {
          employee_id: req.employee.employee_id,
          employee_name: req.employee.first_name + " " + req.employee.last_name,
          email: req.employee.email,
        },
      };

      // Create new project
      await mongoFunctions.create_new_record("PROJECTS", new_project_data);
      console.log("new project created");

      return res.status(201).send("Project created successfully");
    }
  })
);

router.post(
  "/add_remove_team",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add remove team route hit");
    let data = req.body;

    // Validate request data
    const { error } = validations.add_remove_team(data);
    if (error) return res.status(400).send(error.details[0].message);

    const userRole = req.employee.admin_type;

    if (data.task_id) {
      if (data.task_id.length === 0) {
        // If task_id is empty, only directors and managers can modify project team
        const admin_types = ["1", "2"];
        if (!admin_types.includes(req.employee.admin_type)) {
          return res.status(403).send("Access denied: Not Authorized");
        }
      } else if (data.task_id.length > 9) {
        // If task_id is provided and length > 9, only team incharges can modify task team
        const admin_types = ["3", "2"];
        if (!admin_types.includes(req.employee.admin_type)) {
          return res.status(403).send("Access denied: Not Authorized");
        }
      } else {
        return res.status(400).send("Invalid Task_Id Length");
      }
    } else {
      if (userRole === "3") {
        return res.status(403).send("Access denied: Not authorized");
      }
    }

    // Find the project
    const project = await mongoFunctions.find_one("PROJECTS", {
      project_id: data.project_id,
    });
    if (!project) return res.status(400).send("Project Not Found");

    // Check if task_id is provided and belongs to the project
    if (data.task_id && data.task_id.length > 9) {
      const task = await mongoFunctions.find_one("TASKS", {
        task_id: data.task_id,
        project_id: data.project_id,
      });
      if (!task)
        return res.status(400).send("Task Does Not Belong To The Project");
    }

    const employeeIds = Array.isArray(data.employee_id)
      ? data.employee_id
      : [data.employee_id];
    console.log(employeeIds);

    if (data.action.toLowerCase() === "add") {
      for (const employeeId of employeeIds) {
        const employee = await mongoFunctions.find_one("EMPLOYEE", {
          employee_id: employeeId,
        });
        if (!employee)
          return res
            .status(400)
            .send(`Employee with ID ${employeeId} not found`);
        if (data.task_id && data.task_id.length > 9) {
          // Add team member to task
          const task = await mongoFunctions.find_one("TASKS", {
            project_id: data.project_id,
            task_id: data.task_id,
          });
          const existingEmployeeIds = employeeIds.filter((employeeId) =>
            task.team.some((member) => member.employee_id === employeeId)
          );

          if (existingEmployeeIds.length > 0) {
            const employeeName = `${employee.basic_info.first_name} ${employee.basic_info.last_name}`;
            return res
              .status(400)
              .send(`${employeeName} Is Already Added To The Project Team.`);
          }

          const team = {
            employee_id: employeeId,
            employee_name:
              employee.basic_info.first_name +
              " " +
              employee.basic_info.last_name,
            date_time: new Date(),
          };

          const newAssignTrack = {
            assigned_by: {
              employee_id: req.employee.employee_id,
              employee_name:
                req.employee.first_name + " " + req.employee.last_name,
              employee_email: req.employee.email,
              date_time: new Date(),
            },
            assigned_to: {
              employee_id: employeeId,
              employee_name:
                employee.basic_info.first_name +
                " " +
                employee.basic_info.last_name,
              date_time: new Date(),
            },
          };

          await mongoFunctions.find_one_and_update(
            "TASKS",
            { project_id: data.project_id, task_id: data.task_id },
            {
              $push: {
                team: team,
                assign_track: newAssignTrack,
              },
            }
          );
        } else {
          const existingEmployeeIds = employeeIds.filter((employeeId) =>
            project.team.some((member) => member.employee_id === employeeId)
          );

          if (existingEmployeeIds.length > 0) {
            const employeeName = `${employee.basic_info.first_name} ${employee.basic_info.last_name}`;
            return res
              .status(400)
              .send(`${employeeName} Is Already Added To The Project Team.`);
          }

          const newAssignTrack = {
            assigned_by: {
              employee_id: req.employee.employee_id,
              employee_name:
                req.employee.first_name + " " + req.employee.last_name,
              employee_email: req.employee.email,
              date_time: new Date(),
            },
            assigned_to: {
              employee_id: employeeId,
              employee_name:
                employee.basic_info.first_name +
                " " +
                employee.basic_info.last_name,
              date_time: new Date(),
            },
          };
          const team = {
            employee_id: employeeId,
            employee_name:
              employee.basic_info.first_name +
              " " +
              employee.basic_info.last_name,
            date_time: new Date(),
            department_id: employee.work_info.department_id,
            department_name: employee.work_info.department_name,
          };

          await mongoFunctions.find_one_and_update(
            "PROJECTS",
            { project_id: data.project_id },
            {
              $push: {
                team: team,
                assign_track: newAssignTrack,
              },
            }
          );
        }
      }
      console.log("team added succesfully");

      return res.status(200).send("Team Added Successfully");
    } else if (data.action.toLowerCase() === "remove") {
      for (const employeeId of employeeIds) {
        if (data.task_id && data.task_id.length > 9) {
          // Remove team member from task
          await mongoFunctions.find_one_and_update(
            "TASKS",
            { project_id: data.project_id, task_id: data.task_id },
            { $pull: { team: { employee_id: employeeId } } }
          );
        } else {
          const employee = await mongoFunctions.find_one("EMPLOYEE", {
            employee_id: employeeId,
          });
          if (!employee)
            return res
              .status(400)
              .send(`Employee with ID ${employeeId} not found`);
          const existingEmployeeIds = employeeIds.filter((employeeId) =>
            project.team.some((member) => member.employee_id === employeeId)
          );

          if (existingEmployeeIds.length === 0) {
            const employeeName = `${employee.basic_info.first_name} ${employee.basic_info.last_name}`;
            return res
              .status(400)
              .send(`${employeeName} Is Not Exist In The Project Team.`);
          }
          // Remove team member from project
          await mongoFunctions.find_one_and_update(
            "PROJECTS",
            { project_id: data.project_id },
            { $pull: { team: { employee_id: employeeId } } }
          );
        }
      }

      return res.status(200).send("Team Member Removed Successfully");
    } else {
      return res.status(400).send("Invalid Action");
    }
  })
);

router.post(
  "/update_task_team",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    let data = req.body;

    // Validate request data
    const { error } = validations.update_task_team(data);
    if (error) return res.status(400).send(error.details[0].message);

    const userRole = req.employee.admin_type;
    // Find the project
    const project = await mongoFunctions.find_one("PROJECTS", {
      project_id: data.project_id,
    });
    if (!project) return res.status(400).send("Project Not Found");

    // Check if task_id is provided and belongs to the project
    if (data.task_id && data.task_id.length > 9) {
      const task = await mongoFunctions.find_one("TASKS", {
        task_id: data.task_id,
        project_id: data.project_id,
      });
      if (!task)
        return res.status(400).send("Task Does Not Belong To The Project");
      let employee = await mongoFunctions.find_one("EMPLOYEE", {
        employee_id: data.employee_id,
      });

      if (data.action.toLowerCase() === "add") {
        if (!employee) return res.status(400).send(`Employee Not Found`);
        if (task.employee_id && task.employee_id === data.employee_id) {
          return res
            .status(400)
            .send("Employee Is Already Assigned To The Task.");
        }
        const newAssignTrack = {
          assigned_by: {
            employee_id: req.employee.employee_id,
            employee_name:
              req.employee.first_name + " " + req.employee.last_name,
            employee_email: req.employee.email,
            date_time: new Date(),
          },
          assigned_to: {
            employee_id: data.employee_id,
            employee_name:
              employee.basic_info.first_name +
              " " +
              employee.basic_info.last_name,
            date_time: new Date(),
          },
        };
        await mongoFunctions.find_one_and_update(
          "TASKS",
          { project_id: data.project_id, task_id: data.task_id },
          {
            $set: {
              employee_id: data.employee_id,
              employee_name:
                employee.basic_info.first_name +
                " " +
                employee.basic_info.last_name,
              department_id: employee.work_info.department_id,
            },
            $push: {
              assign_track: newAssignTrack,
            },
          }
        );
        return res.status(200).send("Team Member Added Successfully..!");
      }
      if (data.action.toLowerCase() === "remove") {
        if (!employee) return res.status(400).send(`Employee Not Found`);
        if (data.task_id && data.task_id.length > 9) {
          if (!task.employee_id === data.employee_id) {
            return res
              .status(400)
              .send("Employee Is Already Removed From The Task.");
          }

          // Remove team member from task
          await mongoFunctions.find_one_and_update(
            "TASKS",
            { project_id: data.project_id, task_id: data.task_id },
            {
              employee_id: "",
              employee_name: "",
              department_id: "",
            }
          );
        }
        return res.status(200).send("Team Member Removed Successfully..!");
      }
    }
  })
);

module.exports = router;

router.post(
  "/add_update_task",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("add update task route hit");

    // Validate request data
    const { error, value } = validations.add_update_task(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    let data = value;

    // Check user role
    const userRole = req.employee.admin_type;
    const admin_types = ["3", "2", "1"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Access denied: Not Team Incharge Or Manager");
    }
    const findId = await mongoFunctions.find_one("PROJECTS", {
      organisation_id: req.employee.organisation_id,
      project_id: data.project_id,
      // team: { $elemMatch: { employee_id: req.employee.employee_id } }
    });
    console.log(data.roject_id);
    if (!findId) {
      return res.status(400).send("Project Does Not Exist");
    }
    let employee = await mongoFunctions.find_one("EMPLOYEE", {
      employee_id: data.employee_id,
    });

    if (userRole === "3") {
      const findId = await mongoFunctions.find_one("PROJECTS", {
        organisation_id: req.employee.organisation_id,
        project_id: data.project_id,
        team: { $elemMatch: { employee_id: req.employee.employee_id } },
        // req.employee.employee_id,
        // { $elemMatch: { employee_id: req.employee.employee_id } }
      });

      if (!findId) return res.status(400).send("Project Does Not Exist");
    }

    if (data.task_id && data.task_id.length > 9) {
      // Check if task ID exists
      const findId = await mongoFunctions.find_one("TASKS", {
        organisation_id: req.employee.organisation_id,
        task_id: data.task_id,
      });

      if (!findId) return res.status(400).send("Task ID Does Not Exist");
      let set_update;
      let push_update;

      if (data.action.length > 0 && data.action.toLowerCase() === "add") {
        if (!employee) return res.status(400).send(`Employee Not Found`);
        // if (findId.employee_id && findId.employee_id === data.employee_id) {
        //   return res
        //     .status(400)
        //     .send("Employee Is Already Assigned To The Task.");
        // }

        let newAssignTrack = [
          {
            assigned_by: {
              employee_id: req.employee.employee_id,
              employee_name:
                req.employee.first_name + " " + req.employee.last_name,
              employee_email: req.employee.email,
              date_time: new Date(),
            },
            assigned_to: {
              employee_id: data.employee_id,
              employee_name:
                employee.basic_info.first_name +
                " " +
                employee.basic_info.last_name,
              date_time: new Date(),
            },
          },
        ];

        set_update = {
          task_name: data.task_name.toLowerCase(),
          status: data.status,
          description: data.description,
          task_status: data.task_status,
          due_date: new Date(data.due_date),
          time: data.time,
          priority: data.priority,
          completed_date: data.completed_date
            ? data.completed_date
            : new Date(),
          employee_id: data.employee_id,
          employee_name:
            employee.basic_info.first_name +
            " " +
            employee.basic_info.last_name,
          department_id: employee.work_info.department_id,
          assign_track: newAssignTrack,
        };
        push_update = {
          // assign_track: newAssignTrack,
          modified_by: {
            employee_id: req.employee.employee_id,
            employee_name:
              req.employee.first_name + " " + req.employee.last_name,
            employee_email: req.employee.email,
            modifiedAt: new Date(),
            prevStatus: findId.status,
            currentStatus: data.status,
          },
        };
      }
      if (data.action.length > 0 && data.action.toLowerCase() === "remove") {
        if (!employee) return res.status(400).send(`Employee Not Found`);

        if (!findId.employee_id === data.employee_id) {
          return res
            .status(400)
            .send("Employee Is Already Removed From The Task.");
        }
        set_update = {
          task_name: data.task_name.toLowerCase(),
          status: data.status,
          description: data.description,
          task_status: data.task_status,
          due_date: new Date(data.due_date),
          time: data.time,
          priority: data.priority,
          completed_date: data.completed_date
            ? data.completed_date
            : new Date(),
          employee_id: "",
          employee_name: "",
          department_id: "",
          assign_track: [],
        };
        push_update = {
          modified_by: {
            employee_id: req.employee.employee_id,
            employee_name:
              req.employee.first_name + " " + req.employee.last_name,
            employee_email: req.employee.email,
            modifiedAt: new Date(),
            prevStatus: findId.status,
            currentStatus: data.status,
          },
        };
        await redisFunctions.remove_task_status(data.employee_id, data.status);
      }

      // Update task
      const task_data_up = await mongoFunctions.find_one_and_update(
        "TASKS",
        {
          organisation_id: req.employee.organisation_id,
          task_id: data.task_id,
        },
        {
          $set: set_update,
          $push: push_update,
        },
        { new: true }
      );
      if (
        findId.status === "in_progress" &&
        (task_data_up.status === "under_review" ||
          task_data_up.status === "hold")
      ) {
        let s = await stats.calculate_working_time(
          task_data_up.modified_by,
          task_data_up.task_id
        );

        console.log(s);
      }

      console.log("task updated successfully");

      if (!task_data_up) return res.status(400).send("Task Update Failed");
      if (data.action === "add") {
        if (
          findId.employee_id === data.employee_id &&
          findId.status !== data.status
        ) {
          await redisFunctions.update_task_status(
            data.employee_id,
            data.status,
            findId.status
          );
          await redisFunctions.update_task_status(
            findId.created_by.employee_id,
            data.status,
            findId.status
          );
        } else if (
          findId.employee_id !== data.employee_id &&
          findId.status !== data.status
        ) {
          await redisFunctions.add_task_status(data.employee_id, data.status);
          await redisFunctions.update_task_status(
            findId.created_by.employee_id,
            data.status,
            findId.status
          );
        } else if (findId.employee_id !== data.employee_id) {
          await redisFunctions.add_task_status(data.employee_id, data.status);
        }
      }
      return res.status(200).send("Task Updated Successfully");
    } else {
      if (!data.action) {
        return res
          .status(400)
          .send("Action Is Required To Add Team Member Into Task");
      }
      if (data.action.toLowerCase() === "add") {
        if (!employee) return res.status(400).send(`Employee Not Found`);

        const newAssignTrack = {
          assigned_by: {
            employee_id: req.employee.employee_id,
            employee_name:
              req.employee.first_name + " " + req.employee.last_name,
            employee_email: req.employee.email,
            date_time: new Date(),
          },
          assigned_to: {
            employee_id: data.employee_id,
            employee_name:
              employee.basic_info.first_name +
              " " +
              employee.basic_info.last_name,
            date_time: new Date(),
          },
        };

        const new_task_data = {
          organisation_id: req.employee.organisation_id,
          task_id: functions.get_random_string("TA", 9, true),
          project_id: data.project_id,
          project_name: findId.project_name,
          task_name: data.task_name.toLowerCase(),
          employee_id: data.employee_id,
          employee_name:
            employee.basic_info.first_name +
            " " +
            employee.basic_info.last_name,
          department_id: employee.work_info.department_id,
          // start_date: data.start_date,
          // end_date: data.end_date,
          description: data.description,
          due_date: new Date(data.due_date),
          time: data.time,
          priority: data.priority,
          status: data.status,
          task_status: data.task_status,
          created_by: {
            employee_id: req.employee.employee_id,
            employee_name:
              req.employee.first_name + " " + req.employee.last_name,
            email: req.employee.email,
          },
          assign_track: newAssignTrack,
        };

        // Create new project
        const task_add = await mongoFunctions.create_new_record(
          "TASKS",
          new_task_data
        );
        if (!task_add) {
          return res.status(400).send("Failed To Add New Task..");
        }
        await redisFunctions.add_task_status(
          req.employee.employee_id,
          new_task_data.status
        );
        await redisFunctions.add_task_status(
          new_task_data.employee_id,
          new_task_data.status
        );

        return res.status(201).send("Task Created Successfully");
      }
    }
  })
);
router.post(
  "/update_project",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("update project route hit");
    let data = req.body;
    const { error } = validations.update_project(data);
    if (error) return res.status(400).send(error.details[0].message);
    const userRole = req.employee.admin_type;
    if (userRole !== "3") {
      return res.status(403).send("Access denied: Not Team Incharge");
    }
    const findId = await mongoFunctions.find_one("PROJECTS", {
      organisation_id: req.employee.organisation_id,
      project_id: data.project_id,
      team: { $elemMatch: { employee_id: req.employee.employee_id } },
    });
    if (!findId) return res.status(400).send("Project ID Does Not Exist");
    const project_data_up = await mongoFunctions.find_one_and_update(
      "PROJECTS",
      {
        organisation_id: req.employee.organisation_id,
        project_id: data.project_id,
      },
      {
        $set: {
          status: data.status,
        },
        $push: {
          modified_by: {
            employee_id: req.employee.employee_id,
            employee_name:
              req.employee.first_name + " " + req.employee.last_name,
            employee_email: req.employee.email,
            modifiedAt: new Date(),
            prevStatus: findId.status,
            currentStatus: data.status,
          },
        },
      },
      { new: true } // Optionally return the updated document
    );
    console.log("project updated successfully");
    if (!project_data_up) return res.status(400).send("Project Update Failed");
    return res.status(200).send("Project Updated Successfully");
  })
);

router.post(
  "/update_leave_application",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("update leave application by tl,manager route hit");
    let data = req.body;
    const { error } = validations.update_leave(data);
    if (error) return res.status(400).send(error.details[0].message);
    const admin_types = ["3", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Access denied: Not Team Incharge or Manager");
    }
    const findId = await mongoFunctions.find_one("LEAVE", {
      organisation_id: req.employee.organisation_id,
      leave_application_id: data.leave_application_id,
      // leave_status: data.leave_status
    });
    if (
      req.employee.admin_type === "2" &&
      req.employee.email.toLowerCase() !==
        findId.reporting_manager.toLowerCase()
    ) {
      return res
        .status(403)
        .send(
          "Access Denied..Only Reporting Manager Can Update The Leave Status"
        );
    }
    if (!findId) return res.status(400).send("No Leave Application Found");
    console.log(findId);
    const findEmployee = await mongoFunctions.find_one("EMPLOYEE", {
      organisation_id: req.employee.organisation_id,
      employee_id: findId.employee_id,
      "leaves.leave_id": findId.leave_type_id,
    });
    console.log(findEmployee);
    if (!findEmployee)
      return res
        .status(400)
        .send("No Employee Found for the given application");
    const leaveRecord = findEmployee.leaves.find(
      (leave) => leave.leave_id === findId.leave_type_id
    );
    if (!leaveRecord) {
      return res
        .status(400)
        .send("No Leave Record Found For The Given Leave Type");
    }

    if (leaveRecord && leaveRecord.remaining_leaves <= 0) {
      return res
        .status(400)
        .send("Limit Exceeded: Employee Has No Remaining Leaves");
    }

    let approved_by = findId.approved_by;
    if (req.employee.admin_type === "3") {
      approved_by.team_incharge = {
        employee_id: req.employee.employee_id,
        email: req.employee.email,
        approvedAt: new Date(),
        leave_status: data.leave_status,
      };
    }
    if (req.employee.admin_type === "2") {
      approved_by.manager = {
        employee_id: req.employee.employee_id,
        email: req.employee.email,
        approvedAt: new Date(),
        leave_status: data.leave_status,
      };
    }

    let leave_data_up = await mongoFunctions.find_one_and_update(
      "LEAVE",
      {
        organisation_id: req.employee.organisation_id,
        leave_application_id: data.leave_application_id,
      },
      {
        $set: {
          approved_by: approved_by,
        },
      }
    );
    const statuses = [
      leave_data_up.approved_by.manager?.leave_status,
      leave_data_up.approved_by.team_incharge?.leave_status,
    ];

    let overallStatus = "Approved";

    for (const status of statuses) {
      if (status === "Rejected") {
        overallStatus = "Rejected";
        break;
      } else if (status === "Pending") {
        overallStatus = "Pending";
      }
    }
    console.log(overallStatus);

    let updated_leave_data = await mongoFunctions.find_one_and_update(
      "LEAVE",
      {
        organisation_id: req.employee.organisation_id,
        leave_application_id: data.leave_application_id,
      },
      { $set: { leave_status: overallStatus } }
    );
    if (updated_leave_data.leave_status === "Approved") {
      const h = await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        {
          organisation_id: req.employee.organisation_id,
          employee_id: findId.employee_id,
          "leaves.leave_id": findId.leave_type_id,
        },
        {
          $inc: { "leaves.$.remaining_leaves": -findId.days_taken },
        }
      );
      console.log(h.leaves);

      // Create leave records for each date between from_date and to_date
      const fromDate = new Date(updated_leave_data.from_date);
      const toDate = new Date(updated_leave_data.to_date);
      const attendanceRecords = [];

      for (
        let date = fromDate;
        date <= toDate;
        date.setDate(date.getDate() + 1)
      ) {
        const day = date.getDay(); // 0 is Sunday, 6 is Saturday
        if (day !== 0 && day !== 6) {
          let startDate = new Date(date);
          let endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 1);

          const attendanceCheck = await mongoFunctions.find("ATTENDANCE", {
            organisation_id: req.employee.organisation_id,
            employee_id: findEmployee.employee_id,
            createdAt: {
              $gte: startDate,
              $lt: endDate,
            },
          });
          console.log(attendanceCheck.length);

          // If there's an existing attendance record for that date, delete it
          if (attendanceCheck.length > 0) {
            const h = await mongoFunctions.delete_many("ATTENDANCE", {
              organisation_id: req.employee.organisation_id,
              employee_id: findEmployee.employee_id,
              createdAt: {
                $gte: startDate,
                $lt: endDate,
              },
            });
            console.log(h);
          }
          // Exclude weekend
          const attendance_object = {
            attendance_id:
              functions.get_random_string("A", 3, true) + Date.now(),
            organisation_id: findEmployee.organisation_id,
            employee_id: findEmployee.employee_id,
            employee_name: `${findEmployee.basic_info.first_name} ${findEmployee.basic_info.last_name}`,
            status: "leave",
            checkin: [],
            checkout: [],
            attendance_status: updated_leave_data.leave_type,
            createdAt: new Date(date), // Use the current date in the loop
          };

          attendanceRecords.push(attendance_object);
        }
      }

      const attendance_update = await mongoFunctions.insert_many_records(
        "ATTENDANCE",
        attendanceRecords
      );
      if (!attendance_update)
        return res
          .status(400)
          .send(
            "Attendance Update Failed To Create Leave Status Records After Approving Leave Application"
          );
      // Increment today's leave stats
      // const fromDateObj = updated_leave_data.from_date; // Date object
      // const toDateObj = updated_leave_data.to_date; // Date object

      // // Log the date objects for debugging
      // console.log("From Date Object:", fromDateObj);
      // console.log("To Date Object:", toDateObj);

      // // Start of today (midnight in UTC)
      // const today = new Date();
      // today.setUTCHours(0, 0, 0, 0);
      // console.log("Today:", today);

      // // Create the next day of toDate
      // const nextDayToDate = new Date(toDateObj);
      // nextDayToDate.setUTCDate(nextDayToDate.getUTCDate() + 1);
      // console.log("Next Day to Date:", nextDayToDate);

      // // Check the comparison
      // const isTodayInLeaveRange = fromDateObj <= today && today < nextDayToDate;
      // console.log("Is today in leave range:", isTodayInLeaveRange);

      // if (isTodayInLeaveRange) {
      //   const stat = await functions.add_overall_stats(attendance_update[0]);
      //   console.log(stat);
      // } else {
      //   console.log("Today's date is not in the leave range.");
      // }
    }

    if (updated_leave_data.leave_status === "Rejected") {
      const l = await mongoFunctions.find_one_and_update(
        "LEAVE",
        {
          organisation_id: req.employee.organisation_id,
          employee_id: findId.employee_id,
        },
        {
          $set: { lop_leaves: findId.days_taken }, // Set the LOP leaves
        }
      );
      console.log(l.leaves);
    }

    return res.status(200).send("Leave Status Updated Successfully");
  })
);
router.post(
  "/update_leave_status",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    console.log("updated leave status by admin route hit");
    let data = req.body;
    const { error } = validations.update_leave(data);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.admin_type !== "1") {
      return res.status(400).send("Access denied: Not Admin");
    }
    const findId = await mongoFunctions.find_one("LEAVE", {
      organisation_id: req.employee.organisation_id,
      leave_application_id: data.leave_application_id,
      // leave_status:reject
      // leave_status: data.leave_status
    });
    if (!findId) return res.status(400).send("No Leave Application Found");
    if (findId && findId.leave_status === data.leave_status)
      return res
        .status(400)
        .send(
          `Leave Application Is Already In The ${data.leave_status} Status`
        );
    console.log(findId);
    const findEmployee = await mongoFunctions.find_one("EMPLOYEE", {
      organisation_id: req.employee.organisation_id,
      employee_id: findId.employee_id,
      "leaves.leave_id": findId.leave_type_id,
    });
    // console.log(findEmployee);
    if (!findEmployee)
      return res
        .status(400)
        .send("No Employee Found For The Given Application");
    const leaveRecord = findEmployee.leaves.find(
      (leave) => leave.leave_id === findId.leave_type_id
    );
    if (!leaveRecord) {
      return res
        .status(400)
        .send("No Leave Record Found For The Given Leave Type");
    }

    if (
      data.leave_status === "Approved" &&
      leaveRecord &&
      leaveRecord.remaining_leaves <= 0
    ) {
      return res
        .status(400)
        .send("Limit Exceeded: Employee Has No Remaining Leaves");
    }

    let leave_data_up = await mongoFunctions.find_one_and_update(
      "LEAVE",
      {
        organisation_id: req.employee.organisation_id,
        leave_application_id: data.leave_application_id,
      },
      {
        $set: {
          leave_status: data.leave_status,
        },
      }
    );

    if (
      findId.leave_status === "Pending" &&
      leave_data_up.leave_status === "Approved"
    ) {
      await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        {
          organisation_id: req.employee.organisation_id,
          employee_id: findId.employee_id,
          "leaves.leave_id": findId.leave_type_id,
        },
        {
          $inc: { "leaves.$.remaining_leaves": -findId.days_taken },
        }
      );

      // Create leave records for each date between from_date and to_date
      const fromDate = new Date(leave_data_up.from_date);
      const toDate = new Date(leave_data_up.to_date);
      const attendanceRecords = [];

      for (
        let date = fromDate;
        date <= toDate;
        date.setDate(date.getDate() + 1)
      ) {
        const day = date.getDay(); // 0 is Sunday, 6 is Saturday
        if (day !== 0 && day !== 6) {
          let startDate = new Date(date);
          let endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 1);

          const attendanceCheck = await mongoFunctions.find("ATTENDANCE", {
            organisation_id: req.employee.organisation_id,
            employee_id: findEmployee.employee_id,
            createdAt: {
              $gte: startDate,
              $lt: endDate,
            },
          });
          console.log(attendanceCheck.length);

          // If there's an existing attendance record for that date, delete it
          if (attendanceCheck.length > 0) {
            const h = await mongoFunctions.delete_many("ATTENDANCE", {
              organisation_id: req.employee.organisation_id,
              employee_id: findEmployee.employee_id,
              createdAt: {
                $gte: startDate,
                $lt: endDate,
              },
            });
            console.log(h);
          }
          const attendance_object = {
            attendance_id:
              functions.get_random_string("A", 3, true) + Date.now(),
            organisation_id: findEmployee.organisation_id,
            employee_id: findEmployee.employee_id,
            employee_name: `${findEmployee.basic_info.first_name} ${findEmployee.basic_info.last_name}`,
            status: "leave",
            checkin: [],
            checkout: [],
            attendance_status: leave_data_up.leave_type,
            createdAt: new Date(date), // Use the current date in the loop
          };

          attendanceRecords.push(attendance_object);
        }
      }
      // console.log("query-->", {
      //   organisation_id: req.employee.organisation_id,
      //   employee_id: findId.employee_id,

      //   createdAt: {
      //     $gte: new Date(leave_data_up.to_date),
      //     $lte: new Date(leave_data_up.from_date),
      //   },
      // });

      // const att_rec = await mongoFunctions.find("ATTENDANCE", {
      //   organisation_id: req.employee.organisation_id,
      //   employee_id: findId.employee_id,

      //   createdAt: {
      //     $gte: new Date(leave_data_up.to_date),
      //     $lte: new Date(leave_data_up.from_date),
      //   },
      // });
      // console.log("---", att_rec.length);
      // // console.log("---", att_rec);
      // const h = await mongoFunctions.delete_many("ATTENDANCE", {
      //   organisation_id: req.employee.organisation_id,
      //   employee_id: findId.employee_id,
      //   createdAt: {
      //     $gte: new Date(leave_data_up.to_date),
      //     $lte: new Date(leave_data_up.from_date),
      //   },
      // });
      // console.log(h);

      const attendance_update = await mongoFunctions.insert_many_records(
        "ATTENDANCE",
        attendanceRecords
      );
      if (!attendance_update)
        return res
          .status(400)
          .send(
            "Attendance Update Failed To Create Leave Status Records After Approving Leave Application"
          );

      console.log("updated count for pending to approved status");
      // Increment today's leave stats
      // const fromDateObj = leave_data_up.from_date; // Already a Date object
      // const toDateObj = leave_data_up.to_date; // Already a Date object

      // // Log the date objects for debugging
      // console.log("From Date Object:", fromDateObj);
      // console.log("To Date Object:", toDateObj);

      // // Create a new Date object for iteration
      // let currentDate = new Date(fromDateObj); // Make a copy to iterate

      // // Loop through each date until the end date
      // while (currentDate <= toDateObj) {
      //   // Check if the current date is a weekday (Mon-Fri)
      //   const day = currentDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
      //   if (day !== 0 && day !== 6) {
      //     // Log the current date being processed
      //     console.log("Processing Date:", currentDate);
      //     console.log(attendance_update[0]);

      //     // Call add_overall_stats for the current date
      //     const stat = await functions.add_overall_stats(
      //       attendance_update[0], // Include existing data
      //       currentDate // Add the current date to the stats
      //     );

      //     console.log(`Stats updated for ${currentDate}:`, stat);
      //   } else {
      //     console.log(`Skipping weekend date: ${currentDate}`);
      //   }

      //   // Move to the next date
      //   currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      // }

      // console.log("Overall stats updated for all leave dates.");
    }

    if (
      findId.leave_status === "Pending" &&
      leave_data_up.leave_status === "Rejected"
    ) {
      await mongoFunctions.find_one_and_update(
        "LEAVE",
        {
          organisation_id: req.employee.organisation_id,
          employee_id: findId.employee_id,
        },
        {
          $inc: { lop_leaves: +findId.days_taken }, // Set the LOP leaves
        }
      );
      console.log("updated count for pending to rejected status");
    }
    if (
      findId.leave_status === "Approved" &&
      leave_data_up.leave_status === "Rejected"
    ) {
      await mongoFunctions.delete_many("ATTENDANCE", {
        organisation_id: req.employee.organisation_id,
        employee_id: findId.employee_id,
        status: "leave",
        createdAt: {
          $gte: new Date(leave_data_up.from_date),
          $lte: new Date(leave_data_up.to_date),
        },
      });
      await mongoFunctions.find_one_and_update(
        "LEAVE",
        {
          organisation_id: req.employee.organisation_id,
          employee_id: findId.employee_id,
        },
        {
          $inc: { lop_leaves: +findId.days_taken }, // Set the LOP leaves
        }
      );

      await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        {
          organisation_id: req.employee.organisation_id,
          employee_id: findId.employee_id,
          "leaves.leave_id": findId.leave_type_id,
        },
        {
          $inc: { "leaves.$.remaining_leaves": +findId.days_taken },
        }
      );
      console.log("updated count for approved to rejected status");
      // Increment today's leave stats
      const fromDateObj = leave_data_up.from_date; // Date object
      const toDateObj = leave_data_up.to_date; // Date object

      // Log the date objects for debugging
      console.log("From Date Object:", fromDateObj);
      console.log("To Date Object:", toDateObj);

      // Start of today (midnight in UTC)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      console.log("Today:", today);

      // Create the next day of toDate
      const nextDayToDate = new Date(toDateObj);
      nextDayToDate.setUTCDate(nextDayToDate.getUTCDate() + 1);
      console.log("Next Day to Date:", nextDayToDate);

      // Check the comparison
      // const isTodayInLeaveRange = fromDateObj <= today && today < nextDayToDate;
      // console.log("Is today in leave range:", isTodayInLeaveRange);

      // if (isTodayInLeaveRange) {
      //   const stat = await mongoFunctions.find_one_and_update()
      //   console.log(stat);
      // } else {
      //   console.log("Today's date is not in the leave range.");
      // }
    }
    // if (findId.leave_status==="Rejected" && leave_data_up.leave_status === "Approved") {
    //   const l = await mongoFunctions.find_one_and_update(
    //     "LEAVE",
    //     {
    //       organisation_id: req.employee.organisation_id,
    //       employee_id: findId.employee_id
    //     },
    //     {
    //       $inc: { lop_leaves: -findId.days_taken }  // Set the LOP leaves
    //     }
    //   );
    //   console.log(l);
    // }
    // const h = await mongoFunctions.find_one_and_update(
    //     "EMPLOYEE",
    //     {
    //       organisation_id: req.employee.organisation_id,
    //       employee_id: findId.employee_id,
    //       "leaves.leave_id": findId.leave_type_id
    //     },
    //     {
    //       $inc: { "leaves.$.remaining_leaves": -findId.days_taken }
    //     }
    //   );
    //   console.log(h);

    return res.status(200).send("Leave Status Updated Successfully");
  })
);

//update checkin and checkout time by admin
router.post(
  "/update_attendance",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    let data = req.body;
    const { error } = validations.checkin_checkout_update(data);
    if (error) return res.status(400).send(error.details[0].message);

    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Update The Attendance");
    }

    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data)
      return res.status(400).send("Access Denied; Organisation Not Found!");

    let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
      organisation_id: req.employee.organisation_id,
      employee_id: req.employee.employee_id,
    });
    if (!find_emp) return res.status(400).send("Employee Not Found..!");
    let find_attendance = await mongoFunctions.find_one("ATTENDANCE", {
      organisation_id: req.employee.organisation_id,
      attendance_id: data.attendance_id,
    });
    if (!find_attendance) return res.status(400).send("Attendance Not Found");

    let check_in_obj = {
      in_time: new Date(data.in_time),
      latitude: data.latitude,
      longitude: data.longitude,
      location: data.location,
      ip: data.ip,
    };
    let check_out_obj = {
      out_time: new Date(data.out_time),
      latitude: data.latitude,
      longitude: data.longitude,
      location: data.location,
      ip: data.ip,
    };
    let update;

    if (data.in_time.length > 0 && data.out_time.length === 0) {
      const in_time = new Date(data.in_time);

      const localInTime = new Date(
        in_time.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      );
      const nine_thirty_AM = new Date(localInTime);
      nine_thirty_AM.setHours(9, 30, 0, 0);

      // if (localInTime < nine_thirty_AM) {
      //   return res.status(400).send("Check-in Time Cannot Be Before 9:30 AM.");
      // }

      update = {
        checkin: check_in_obj,
        status: "checkin",
        attendance_status: "",
      };
    } else {
      const in_time = new Date(data.in_time);
      const out_time = new Date(data.out_time);

      const localInTime = new Date(
        in_time.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      );
      const localOutTime = new Date(
        out_time.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      );
      const nine_thirty_AM = new Date(localInTime);
      nine_thirty_AM.setHours(9, 30, 0, 0);

      const ten_AM = new Date(localOutTime);
      ten_AM.setHours(10, 0, 0, 0);

      // if (localInTime < nine_thirty_AM) {
      //   return res.status(400).send("Check-in Time Cannot Be Before 9:30 AM.");
      // }
      if (localOutTime < ten_AM) {
        return res.status(400).send("Checkout Time Cannot Be Before 10 AM.");
      }
      console.log(localInTime);
      console.log(localOutTime);
      if (localOutTime < localInTime) {
        return res
          .status(400)
          .send("Checkout Time Cannot Less Than Checkin Time.");
      }

      update = {
        checkin: check_in_obj,
        checkout: check_out_obj,
        status: "checkout",
      };
    }

    let attendance_obj = await mongoFunctions.find_one_and_update(
      "ATTENDANCE",
      { attendance_id: data.attendance_id },
      {
        $set: update,
      },
      { new: true } // This option should be here
    );
    // let m = await functions.add_overall_stats(attendance_obj, new Date());
    // console.log(m);

    const s = await stats.calculate_working_minutes(attendance_obj);
    console.log(s);
    return res.status(200).send({
      success: "Attendance Updated Successfully",
      data: [
        attendance_obj.checkin[attendance_obj.checkin.length - 1],
        attendance_obj.checkout[attendance_obj.checkout.length - 1],
        attendance_obj.total_working_minutes,
      ],
    });
  })
);
router.post(
  "/remove_checkout",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    let data = req.body;
    const { error } = validations.delete_data(data);
    if (error) return res.status(400).send(error.details[0].message);

    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Update The Attendance");
    }

    let org_data = await redisFunctions.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    if (!org_data)
      return res.status(400).send("Access Denied; Organisation Not Found!");

    let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
      organisation_id: req.employee.organisation_id,
      employee_id: req.employee.employee_id,
    });
    if (!find_emp) return res.status(400).send("Employee Not Found..!");
    let find_attendance = await mongoFunctions.find_one("ATTENDANCE", {
      organisation_id: req.employee.organisation_id,
      attendance_id: data.id,
    });
    if (!find_attendance) return res.status(400).send("Attendance Not Found");
    const update = {
      checkout: [],
      total_working_minutes: 0,
      attendance_status: "",
      status: "checkin",
    };
    let attendance_obj = await mongoFunctions.find_one_and_update(
      "ATTENDANCE",
      { attendance_id: data.id },
      {
        $set: update,
      },
      { new: true } // This option should be here
    );
    if (!attendance_obj) {
      return res.status(400).send("Failed To Delete Checkout");
    }
    return res.status(200).send("Checkout Removed Successfully..!");
  })
);
//add event

router.post(
  "/add_event",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const rawInput = req.body;
    const admin_type = req.employee.admin_type;

    // ✅ Validate input
    const { error, value: data } = validations.add_update_events(rawInput);
    if (error) return res.status(400).send(error.details[0].message);

    // ✅ Build base event object
    const event_object = {
      organisation_id: req.employee.organisation_id,
      title: data.title,
      description: data.description,
      date: moment(data.date).toDate(),
      type: data.type?.toLowerCase(),
      assigned_to: data.assigned_to,
      added_by: {
        name: `${req.employee.first_name} ${req.employee.last_name}`,
        employee_id: req.employee.employee_id,
        email: req.employee.email,
      },
    };

    let event;

    // ➕ ADD
    if (data.route_action === 1) {
      if (!["1", "2", "3"].includes(admin_type)) {
        return res
          .status(403)
          .send("Only Director, Manager, or Supervisor can add events");
      }

      event_object.event_id = functions.get_random_string("EVENT", 10, true);

      event = await mongoFunctions.create_new_record("EVENTS", event_object);

      return res.status(200).send({
        message: "Event Added Successfully",
        event,
      });
    }

    // 🔄 UPDATE
    else if (data.route_action === 2) {
      if (!data.event_id || data.event_id.length <= 2) {
        return res.status(400).send("Event ID required for update");
      }

      const existing_event = await mongoFunctions.find_one("EVENTS", {
        event_id: data.event_id,
        organisation_id: req.employee.organisation_id,
      });

      if (!existing_event) {
        return res.status(404).send("Event not found for update");
      }

      // ✅ Allow full update for types 1, 2, and 3
      if (["1", "2", "3"].includes(admin_type)) {
        event = await mongoFunctions.find_one_and_update(
          "EVENTS",
          {
            event_id: data.event_id,
            organisation_id: req.employee.organisation_id,
          },
          { $set: event_object }
        );

        return res.status(200).send({
          message: "Event Updated Successfully",
          event,
        });
      }

      // ❌ All others are denied
      return res.status(403).send("Unauthorized: Cannot update event");
    }

    // ❌ DELETE
    else if (data.route_action === 3) {
      if (!["1", "2", "3"].includes(admin_type)) {
        return res
          .status(403)
          .send("Only Director, Manager, or Supervisor can delete events");
      }

      if (!data.event_id || data.event_id.length <= 2) {
        return res.status(400).send("Event ID required for deletion");
      }

      const result = await mongoFunctions.find_one_and_delete("EVENTS", {
        event_id: data.event_id,
        organisation_id: req.employee.organisation_id,
      });

      if (!result) {
        return res.status(404).send("Event not found for deletion");
      }

      return res.status(200).send({ message: "Event Deleted Successfully" });
    }

    // 🚫 Invalid action
    else {
      return res.status(400).send("Invalid route_action provided");
    }
  })
);
// Add / Update / Delete Lead (no auth route)
router.post(
  "/add_update_lead",
  // Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const rawInput = encrypt_decrypt.decryptobj(req.body.enc);
    console.log(rawInput);

    // Validate input
    const { error, value: data } = validations.add_update_postings(rawInput);
    if (error) return res.status(400).send(error.details[0].message);

    // Access control from payload
    const validKeys = ["scanglobal", "crm"];
    if (!validKeys.includes(data.key)) {
      return res.status(403).send("Access denied: Invalid key");
    }

    if (
      data.key === "crm" &&
      (!data.organisation_id ||
        data.organisation_id.length <= 2 ||
        !validKeys.includes(data.organisation_id))
    ) {
      return res.status(403).send("Access denied: Invalid organisation_id");
    }

    const { admin_type } = data;

    // Check allowed admin types
    if (!["1", "2", "3", "4"].includes(admin_type)) {
      return res.status(403).send("Unauthorized: Invalid admin type");
    }

    // Construct lead object
    const lead_object = {
      organisation_id: data.organisation_id,
      lead_name: data.lead_name?.toLowerCase(),
      source: data.org_type,
      email: data.email?.toLowerCase(),
      company: data.company?.toLowerCase(),
      status: data.status?.toLowerCase(),
      assigned_to: data.assigned_to || [],
      next_follow_up: moment(data.next_follow_up).toDate(),
      comments: data.comments || "",
      files: data.files || [],
      added_by: {
        name: data.name,
        employee_id: data.employee_id,
        email: data.email,
      },
    };

    let lead;

    // ➕ ADD
    if (data.route_action === 1) {
      if (!["1", "2"].includes(admin_type)) {
        return res.status(403).send("Only Director or Manager can add leads");
      }

      const new_lead_id = functions.get_random_string("LEAD", 10, true);
      lead_object.lead_id = new_lead_id;

      await mongoFunctions.create_new_record("LEADS", lead_object);

      return res.status(200).send({ message: "Lead Added Successfully" });
    }

    // 🔄 UPDATE
    if (data.route_action === 2) {
      if (!data.lead_id || data.lead_id.length <= 2) {
        return res.status(400).send("Lead ID required for update");
      }

      const existing_lead = await mongoFunctions.find_one("LEADS", {
        lead_id: data.lead_id,
        organisation_id: data.organisation_id,
      });

      if (!existing_lead) {
        return res.status(404).send("Lead not found for update");
      }

      if (["3", "4"].includes(admin_type)) {
        // Only partial update allowed
        await mongoFunctions.find_one_and_update(
          "LEADS",
          {
            lead_id: data.lead_id,
            organisation_id: data.organisation_id,
          },
          {
            $set: {
              status: data.status?.toLowerCase(),
              comments: data.comments || "",
              files: data.files || [],
              next_follow_up: moment(data.next_follow_up).toDate(),
            },
          }
        );

        return res
          .status(200)
          .send({ message: "Lead Status Updated Successfully" });
      }

      // Full update allowed for admin_type 1 and 2
      const old_emp_ids = existing_lead.assigned_to.map((e) => e.employee_id);
      const new_emp_ids = data.assigned_to.map((e) => e.employee_id);

      const isSameSet =
        old_emp_ids.length === new_emp_ids.length &&
        old_emp_ids.every((id) => new_emp_ids.includes(id));

      if (!isSameSet) {
        let duplicate_ids = new_emp_ids.filter((id) =>
          old_emp_ids.includes(id)
        );
        duplicate_ids = [...new Set(duplicate_ids)];

        const duplicate_with_names = duplicate_ids.map((id) => {
          const emp = data.assigned_to.find((e) => e.employee_id === id);
          return `${emp?.employee_name || "Unknown"} (${id})`;
        });

        if (duplicate_with_names.length > 0) {
          return res
            .status(400)
            .send(
              `Employee(s) already assigned: ${duplicate_with_names.join(", ")}`
            );
        }
      }

      await mongoFunctions.find_one_and_update(
        "LEADS",
        {
          lead_id: data.lead_id,
          organisation_id: data.organisation_id,
        },
        { $set: lead_object }
      );

      return res.status(200).send({ message: "Lead Updated Successfully" });
    }

    // ❌ DELETE
    if (data.route_action === 3) {
      if (!["1", "2"].includes(admin_type)) {
        return res
          .status(403)
          .send("Only Director or Manager can delete leads");
      }

      if (!data.lead_id || data.lead_id.length <= 2) {
        return res.status(400).send("Lead ID required for deletion");
      }

      const result = await mongoFunctions.find_one_and_delete("LEADS", {
        lead_id: data.lead_id,
        organisation_id: data.organisation_id,
      });

      if (!result) {
        return res.status(404).send("Lead not found for deletion");
      }

      return res.status(200).send({ message: "Lead Deleted Successfully" });
    }

    // 🚫 Invalid route_action
    return res.status(400).send("Invalid route_action provided");
  })
);

//---------------------------------------------Email functionality-------------------------------------------------------
// Add, Update, Delete Template Route
router.post(
  "/template_action",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const rawInput = req.body;
    // Validate input
    const { error, value: data } =
      validations.add_update_delete_templates(rawInput);
    if (error) return res.status(400).send(error.details[0].message);

    // Access control
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director or Manager can add, update, or delete templates");
    }

    const type = data.route_action.toString();

    // Prepare template object
    const template_object = {
      organisation_id: req.employee.organisation_id,
      type: data.type.toLowerCase(),
      headline: data.headline,
      subject: data.subject,
      added_by: {
        name: `${req.employee.first_name} ${req.employee.last_name}`,
        employee_id: req.employee.employee_id,
        email: req.employee.email,
      },
    };

    // 🔁 Update
    if (type === "2") {
      if (!data.template_id || data.template_id.length < 3) {
        return res.status(400).send("Template ID is required for update");
      }
      // Check if the headline already exists on another template
      const existingHeadline = await mongoFunctions.find_one("TEMPLATES", {
        organisation_id: req.employee.organisation_id,
        headline: { $regex: `^${data.headline}$`, $options: "i" },
        template_id: { $ne: data.template_id },
      });
      if (existingHeadline) {
        return res
          .status(400)
          .send("Another template with this headline already exists.");
      }

      const result = await mongoFunctions.find_one_and_update(
        "TEMPLATES",
        {
          template_id: data.template_id,
          organisation_id: req.employee.organisation_id,
        },
        { $set: template_object }
      );

      if (!result) {
        return res.status(404).send("Template not found during update");
      }

      return res.status(200).send({
        message: "Template Updated Successfully",
        template: result,
      });
    }

    // 🗑️ Delete
    if (type === "3") {
      if (!data.template_id || data.template_id.length < 3) {
        return res.status(400).send("Template ID is required for deletion");
      }

      const delete_result = await mongoFunctions.find_one_and_delete(
        "TEMPLATES",
        {
          template_id: data.template_id,
          organisation_id: req.employee.organisation_id,
        }
      );

      if (!delete_result) {
        return res.status(404).send("Template not found for deletion");
      }

      return res.status(200).send({
        message: "Template Deleted Successfully",
        template_id: data.template_id,
      });
    }

    // ➕ Create
    if (type === "1") {
      // Check for headline uniqueness
      const headlineExists = await mongoFunctions.find_one("TEMPLATES", {
        organisation_id: req.employee.organisation_id,
        headline: { $regex: `^${data.headline}$`, $options: "i" },
      });
      if (headlineExists) {
        return res
          .status(400)
          .send("A template with this headline already exists.");
      }
      const new_template_id = functions.get_random_string("TEM", 10, true);
      template_object.template_id = new_template_id;

      const template = await mongoFunctions.create_new_record(
        "TEMPLATES",
        template_object
      );

      return res.status(200).send({
        message: "Template Added Successfully",
        template: template,
      });
    }

    // 🚫 Invalid type
    return res
      .status(400)
      .send("Invalid action type. Must be 1 (add), 2 (update), or 3 (delete)");
  })
);
//send email by admin

router.post(
  "/compose_email",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const rawInput = req.body;

    // 1. Validate input
    const { error, value: data } = validations.send_email_data(rawInput);
    if (error) return res.status(400).send(error.details[0].message);

    // 2. Access control
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res.status(403).send("Only Director or Manager can compose email");
    }

    // 3. Convert base64 files to Nodemailer attachments
    const attachments = (data.files || [])
      .filter((file) => file.content && file.content.includes("base64,"))
      .map((file) => {
        const base64Data = file.content.split("base64,")[1];
        return {
          filename: file.filename,
          content: Buffer.from(base64Data, "base64"),
          contentType: file.contentType || "application/octet-stream",
        };
      });

    // 4. Configure transporter
    const transporter = Nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "crmadmi01@gmail.com",
        pass: "mmvv ygbi fals sfit", // Make sure to use app password, NOT Gmail login
      },
    });

    // 5. Prepare mail content
    const mailOptions = {
      from: "crmadmi01@gmail.com",
      to: data.to,
      cc: data?.cc ?? undefined,
      subject: data.subject,
      html: `<p>${data.message}</p>`,
      ...(attachments.length > 0 && { attachments }),
    };

    try {
      // 6. Send the email
      await transporter.sendMail(mailOptions);

      // 7. Save success to DB
      const email_data = {
        email_id: functions.get_random_string("EMAIL", 10, true),
        organisation_id: req.employee.organisation_id,
        to: data.to,
        from: "crmadmi01@gmail.com",
        cc: data.cc,
        subject: data.subject,
        link_to_record: data.link_to_record,
        message: data.message,
        files: data.files || [],
        sent_by: {
          employee_id: req.employee.employee_id,
          name: `${req.employee.first_name} ${req.employee.last_name}`.trim(),
          email: req.employee.email,
        },
        status: "SUCCESS",
      };

      await mongoFunctions.create_new_record("EMAILS", email_data);
      return res.status(200).send("Email Sent Successfully!");
    } catch (err) {
      console.error("EMAIL SEND ERROR:", err.message);

      // 8. Save failure to DB
      const email_data = {
        email_id: functions.get_random_string("EMAIL", 10, true),
        organisation_id: req.employee.organisation_id,
        to: data.to,
        from: "crmadmi01@gmail.com",
        link_to_record: data.link_to_record,
        cc: data.cc,
        subject: data.subject,
        message: data.message,
        files: data.files || [],
        sent_by: {
          employee_id: req.employee.employee_id,
          name: `${req.employee.first_name} ${req.employee.last_name}`.trim(),
          email: req.employee.email,
        },
        status: "FAILED",
      };

      await mongoFunctions.create_new_record("EMAILS", email_data);
      return res.status(500).send(`Failed to send email: ${err.message}`);
    }
  })
);
//leads search
router.post(
  "/lead_search",
  Auth,
  rateLimit(60, 10),
  Async(async (req, res) => {
    const rawInput = req.body;

    // 1. Validate input
    const { error, value: data } = validations.lead_search(rawInput);
    if (error) return res.status(400).send(error.details[0].message);

    // 2. Access control
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res.status(403).send("Only Director or Manager can compose email");
    }

    // 3. Build regex-based filter
    let filter = {};
    const leadName = data.lead_name?.trim();
    const company = data.company?.trim();

    if (leadName) {
      filter.lead_name = { $regex: leadName, $options: "i" }; // case-insensitive partial match
    } else if (company) {
      filter.company = { $regex: company, $options: "i" };
    } else {
      return res
        .status(400)
        .send("Please provide lead_name or company to search.");
    }

    // 4. Perform MongoDB query with sort and limit
    const leads = await mongoFunctions.find(
      "LEADS",
      filter,
      { createdAt: -1 }, // sort
      {}
    );

    return res.status(200).send({ leads });
  })
);
//postings route(no auth route)

router.post(
  "/add_update_postings",
  rateLimit(60, 10),
  Async(async (req, res) => {
    let rawInput = encrypt_decrypt.decryptobj(req.body.enc);
    console.log(rawInput);

    // Validate input
    const { error, value: data } = validations.add_update_postings(rawInput);
    if (error) return res.status(400).send(error.details[0].message);

    //Access control from payload
    const keys = ["scanglobal", "crm"];
    if (!keys.includes(data.key)) {
      return res.status(403).send("Access denied");
    }

    // Validate route_action
    const allowed_actions = [1, 2, 3];
    if (!allowed_actions.includes(data.route_action)) {
      return res.status(400).send("Invalid route_action provided");
    }

    // Construct postings data
    const postings_object = {
      organisation_id: data.organisation_id,
      title: (data.title || "").toLowerCase(),
      description: (data.description || "").toLowerCase(),
      key: data.key || null,
      images: data.images || [],
    };

    let postings;

    if (data.route_action === 1) {
      // ➕ ADD
      const new_posting_id = functions.get_random_string("POST", 10, true);
      postings_object.posting_id = new_posting_id;

      postings = await mongoFunctions.create_new_record(
        "POSTINGS",
        postings_object
      );

      return res.status(200).send({
        message: "Posting Added Successfully",
        // posting: postings,
      });
    } else if (data.route_action === 2) {
      // 🔄 UPDATE
      if (!data.posting_id || data.posting_id.length <= 2) {
        return res.status(400).send("Posting ID required for update");
      }

      const existing_posting = await mongoFunctions.find_one("POSTINGS", {
        posting_id: data.posting_id,
        organisation_id: data.organisation_id,
        key: data.key,
      });

      if (!existing_posting) {
        return res.status(404).send("Posting not found for update");
      }

      postings = await mongoFunctions.find_one_and_update(
        "POSTINGS",
        {
          posting_id: data.posting_id,
          organisation_id: data.organisation_id,
          key: data.key,
        },
        { $set: postings_object }
      );

      return res.status(200).send({
        message: "Posting Updated Successfully",
        // posting: postings,
      });
    } else if (data.route_action === 3) {
      // ❌ DELETE
      if (!data.posting_id || data.posting_id.length <= 2) {
        return res.status(400).send("Posting ID required for deletion");
      }

      const result = await mongoFunctions.find_one_and_delete("POSTINGS", {
        posting_id: data.posting_id,
        organisation_id: data.organisation_id,
        key: data.key,
      });

      if (!result) {
        return res.status(404).send("Posting not found for deletion");
      }

      return res.status(200).send({
        message: "Posting Deleted Successfully",
      });
    }
  })
);
