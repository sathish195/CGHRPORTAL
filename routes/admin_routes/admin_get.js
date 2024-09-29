const express = require("express");
const mongoFunctions = require("../../helpers/mongoFunctions");
const router = express.Router();
const validations = require("../../helpers/schema");
const bcrypt = require("../../helpers/crypto");
const jwt = require("jsonwebtoken");
const { Auth } = require("../../middlewares/auth");
const redis = require("../../helpers/redisFunctions");
const { mongo } = require("mongoose");
const Async = require("../../middlewares/async");
const rateLimit = require("../../helpers/custom_rateLimiter");
const slowDown = require("../../middlewares/slow_down");
const { includes } = require("underscore");
const { alertDev } = require("../../helpers/telegram");

//get employee list

//------------------------get emp by id------------------
router.post(
  "/get_emp_by_id",
  Auth,
  Async(async (req, res) => {
    console.log("get emp by id route hit");
    let data = req.body;
    var { error } = validations.employee_id(data);
    if (error) return res.status(400).send(error.details[0].message);
    const emp_find = req.employee;
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access Employee");
    }

    let emp = await mongoFunctions.find_one(
      "EMPLOYEE",
      {
        organisation_id: emp_find.organisation_id,
        employee_id: data.employee_id,
      },
      {
        two_fa_key: 0,
        fcm_token: 0,
        browserid: 0,
        updatedAt: 0,
        _id: 0,
        // password: 0,
      }
    );
    let repo = await mongoFunctions.find_one("EMPLOYEE", {
      organisation_id: req.employee.organisation_id,
      "basic_info.email": emp.work_info.reporting_manager,
    });
    if (repo) {
      emp.work_info.reporting_manager =
        repo.basic_info.first_name + " " + repo.basic_info.last_name;
    }
    return res.status(200).send({ employee: emp });
  })
);
//-----------------get emp by lazy loading--------
router.post(
  "/get_employee_list",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("get employee list route hit");
    const emp = req.employee;
    const LIMIT = 50;
    const data = req.body;
    const { error } = validations.skip(data);

    if (error) return res.status(400).send(error.details[0].message);
    let query = { organisation_id: req.employee.organisation_id };
    if (emp.admin_type === "1") {
      // query["work_info.admin_type"] = { $ne: "1" };
    } else if (emp.admin_type === "2") {
      query["work_info.admin_type"] = { $nin: ["1"] };
    } else if (emp.admin_type === "3") {
      query["work_info.department_id"] = emp.department_id;
      query["work_info.admin_type"] = { $nin: ["1", "2"] };
      // Logic for team incharge
    } else {
      return res.status(403).send("Forbidden: Not Administrator");
    }
    //  Logic for director or manager
    let employees = await mongoFunctions.lazy_loading(
      "EMPLOYEE",
      query,
      { two_fa_key: 0, fcm_token: 0, browserid: 0, others: 0 },
      { _id: -1 },
      LIMIT,
      data.skip
    );
    return res.status(200).send({ employees });
  })
);

router.post(
  "/get_project_by_id",
  Auth,
  Async(async (req, res) => {
    console.log("get project by id route hit");
    let data = req.body;
    var { error } = validations.get_project_by_id(data);
    if (error) return res.status(400).send(error.details[0].message);

    let findProject = await mongoFunctions.find_one("PROJECTS", {
      organisation_id: req.employee.organisation_id,
      project_id: data.project_id,
    });
    if (!findProject) return res.status(400).send("Project Not Found");
    return res.status(200).send(findProject);
  })
);

router.post(
  "/get_projects",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("get projects route hit");

    const userRole = req.employee.admin_type;
    console.log(userRole);
    const organisationId = req.employee.organisation_id;
    const employeeId = req.employee.employee_id;

    if (userRole === "1" || userRole === "2") {
      const projects = await mongoFunctions.find("PROJECTS", {
        organisation_id: organisationId,
      });
      console.log("successfully fetched projects");
      return res.status(200).send(projects);
    } else if (userRole === "3") {
      // Get only the projects where the team incharge's employee ID is in the team array

      const projects = await mongoFunctions.find("PROJECTS", {
        organisation_id: organisationId,
        team: { $elemMatch: { employee_id: employeeId } },
        //
      });
      console.log("successfully fetched projects");
      return res.status(200).send(projects);
    } else {
      const projects = await mongoFunctions.aggregate("TASKS", [
        {
          $match: {
            organisation_id: organisationId,
            team: { $elemMatch: { employee_id: employeeId } },
            // { $elemMatch: { employee_id: employeeId }
          },
        },
        {
          $project: {
            _id: 0,
            project_id: 1,
            project_name: 1,
          },
        },
        {
          $group: {
            _id: "$project_id",
            project_name: { $first: "$project_name" },
          },
        },
        {
          $project: {
            _id: 0,
            project_id: "$_id",
            project_name: 1,
          },
        },
      ]);

      console.log("successfully fetched projects");
      return res.status(200).send(projects);
    }
  })
);
router.post(
  "/all_leave_applications",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("all leave applications route hit");
    let data = req.body;
    const { error } = validations.get_all_leave_applications(data);

    if (error) {
      return res.status(400).send(error.details[0].message);
    }

    const roleName = req.employee.admin_type;
    const status = "Pending";
    const query = {
      organisation_id: req.employee.organisation_id,
      employee_id: { $ne: req.employee.employee_id },
      // "approved_by.team_incharge.leave_status": status
    };
    if (data.leave_status === " " || data.leave_status === "Pending") {
      // Role-based access control
      if (roleName === "4") {
        return res.status(403).send("Access denied: Not Admin");
      }

      if (roleName === "1") {
        query.leave_status = status;
        // No additional conditions for 'director'
      } else if (roleName === "2") {
        query.reporting_manager = req.employee.email;
        query.leave_status = status;
        query["approved_by.manager.leave_status"] = status;
      } else if (roleName === "3") {
        query.department_id = req.employee.department_id;
        query.leave_status = status;

        // Optionally add conditions specific to 'team incharge'
        query["approved_by.team_incharge.leave_status"] = status;
      } else {
        return res.status(403).send("Access denied: Invalid role");
      }
    }

    // Fetch leave applications with pagination

    // Add optional fields to the query
    if (data.employee_id && data.employee_id.length > 5) {
      query.employee_id = data.employee_id;
    }

    if (data.year) {
      const year = parseInt(data.year, 10);
      if (!isNaN(year)) {
        const startOfYear = new Date(year, 0, 1); // January 1st of the given year
        const endOfYear = new Date(year + 1, 0, 0, 23, 59, 59, 999); // December 31st of the given year

        query.createdAt = { $gte: startOfYear, $lte: endOfYear };
      } else {
        return res.status(400).send("Invalid year format.");
      }
    }

    if (data.leave_status && data.leave_status.length > 5) {
      if (roleName === "2") {
        query["approved_by.manager.leave_status"] = data.leave_status;
      } else if (roleName === "3") {
        query["approved_by.team_incharge.leave_status"] = data.leave_status;
      } else {
        query.leave_status = data.leave_status;
      }
    }
    console.log(query);

    // Fetch leave applications with pagination
    alertDev(`query in get leaves-->${JSON.stringify(query)}`);
    const leaveApplications = await mongoFunctions.lazy_loading(
      "LEAVE",
      query,
      { __v: 0, _id: 0 },
      { _id: -1, createdAt: -1 },
      { limit: 40 },
      { skip: data.skip || 0 } // Default skip to 0 if not provided
    );

    let response = { leaveApplications };

    // If employee_id is provided, fetch the employee profile
    if (data.employee_id && data.employee_id.length > 5) {
      const employeeProfile = await mongoFunctions.find_one("EMPLOYEE", {
        employee_id: data.employee_id,
      });

      if (employeeProfile) {
        response.leaves = employeeProfile.leaves;
      } else {
        return res.status(404).send("Employee Not Found.");
      }
    }

    return res.status(200).send(response);

    // return res.status(200).send(leaveApplications);
  })
);

//employee total attendance by admin

router.post(
  "/get_total_attendance_by_admin",
  Auth,
  slowDown,
  Async(async (req, res) => {
    const user = req.employee;
    let data = req.body;
    var { error } = validations.get_emp_attendance_by_admin(data);
    if (error) return res.status(400).send(error.details[0].message);
    const admin_types = ["1", "2"];
    if (!admin_types.includes(req.employee.admin_type)) {
      return res
        .status(403)
        .send("Only Director Or Manager Can Access Employee Total Attendance");
    }
    let condition = {
      organisation_id: user.organisation_id,
    };
    if (!data.employee_id || data.employee_id.length < 1) {
      condition["employee_id"] = req.employee.employee_id;
    }
    if (data.employee_id && data.employee_id.length > 5) {
      condition["employee_id"] = data.employee_id;
    }
    console.log(condition);

    if (data?.week_date) {
      const start = new Date(data.week_date);
      const end = new Date(data.week_date);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek + 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      condition["createdAt"] = {
        $gte: start.toISOString(),
        $lte: end.toISOString(),
      };
    } else {
      const startDate = new Date(data.year, data.month - 1, 1, 0, 0, 0, 0); // Month is 0-based
      const endDate = new Date(data.year, data.month, 0, 23, 59, 59, 999);
      condition["createdAt"] = { $gte: startDate, $lte: endDate };
    }
    let attendance = await mongoFunctions.find(
      "ATTENDANCE",
      condition,
      { createdAt: -1 },
      {
        _id: 0,
        __v: 0,
        updatedAt: 0,
      }
    );

    return res.status(200).send(attendance);
  })
);

module.exports = router;
