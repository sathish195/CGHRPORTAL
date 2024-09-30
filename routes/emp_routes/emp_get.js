const express = require("express");
const mongoFunctions = require("../../helpers/mongoFunctions");
const router = express.Router();
const validations = require("../../helpers/schema");
const bcrypt = require("../../helpers/crypto");
const jwt = require("jsonwebtoken");
const { Auth } = require("../../middlewares/auth");
const redis = require("../../helpers/redisFunctions");
const stats = require("../../helpers/stats");
const Async = require("../../middlewares/async");
const rateLimit = require("../../helpers/custom_rateLimiter");
const slowDown = require("../../middlewares/slow_down");
const multer = require("multer");
const XLSX = require("xlsx");

//get employee profile

router.post(
  "/get_profile",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("get profile route hit");
    const employee = req.employee;
    let emp = await mongoFunctions.find_one(
      employee.collection,
      {
        organisation_id: employee.organisation_id,
        employee_id: employee.employee_id,
      },
      {
        _id: 0,
        __v: 0,
        updatedAt: 0,
        createdAt: 0,
        two_fa_key: 0,
        device_id: 0,
        fcm_token: 0,
        browserid: 0,
        last_ip: 0,
        password: 0,
      }
    );
    let repo = await mongoFunctions.find_one(employee.collection, {
      organisation_id: employee.organisation_id,
      "basic_info.email": emp.work_info.reporting_manager,
    });
    if (repo) {
      emp.work_info.reporting_manager =
        repo.basic_info.first_name + " " + repo.basic_info.last_name;
    }
    if (!emp) return res.status(400).send("Employee Not Found..!");
    return res.status(200).send({ profile: emp });
  })
);

//get universal route

router.post(
  "/universal",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("emp universal route hit");
    let org_data = await redis.redisGet(
      "CRM_ORGANISATIONS",
      req.employee.organisation_id,
      true
    );
    let filtered_org_data = { ...org_data };

    // Exclude specific fields
    delete filtered_org_data.departments;
    delete filtered_org_data.designations;
    delete filtered_org_data.roles;
    const recent_hires = await stats.recent_hires(req.employee.organisation_id);
    const birthdays = await stats.employees_with_birthday_today(
      req.employee.organisation_id
    );
    console.log(birthdays);

    let statss = await mongoFunctions.find_one("STATS", {
      employee_id: req.employee.employee_id,
      createdAt: {
        $gte: new Date().setHours(0, 0, 0, 0),
        $lt: new Date().setHours(24, 0, 0, 0),
      },
    });
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

    let dashborad = {
      recent_hires: recent_hires,
      birthdays: birthdays,
      organisation_details: filtered_org_data,
      stats: statss,
      today_attendance: today_attendance,
    };
    console.log("dashboard data fetched successfully");
    return res.status(200).send(dashborad);
  })
);

router.post(
  "/get_tasks",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("get tasks route hit");

    const userRole = req.employee.admin_type;
    let findTask;
    if (userRole === "2") {
      findTask = await mongoFunctions.find("TASKS", {
        organisation_id: req.employee.organisation_id,
        status: { $nin: [/^completed$/i] },
      });
      return res.status(200).send(findTask);
    }
    if (userRole === "3") {
      findTask = await mongoFunctions.find("TASKS", {
        organisation_id: req.employee.organisation_id,
        status: { $nin: [/^completed$/i, /^manager$/i] },
        "created_by.employee_id": req.employee.employee_id,
      });
      return res.status(200).send(findTask);
    } else {
      findTask = await mongoFunctions.find("TASKS", {
        organisation_id: req.employee.organisation_id,
        status: { $nin: [/^completed$/i, /^under_review$/i] },
        team: { $elemMatch: { employee_id: req.employee.employee_id } },
        assign_track: {
          $elemMatch: {
            "assigned_to.employee_id": req.employee.employee_id,
          },
        },
      });
      return res.status(200).send(findTask);
    }
  })
);
router.post(
  "/get_task_by_id",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("get task by id route hit");
    let data = req.body;
    var { error } = validations.get_task_by_id(data);
    if (error) return res.status(400).send(error.details[0].message);

    let findTask = await mongoFunctions.find_one("TASKS", {
      organisation_id: req.employee.organisation_id,
      task_id: data.task_id,
    });
    if (!findTask) return res.status(400).send("Task not found");
    return res.status(200).send(findTask);
  })
);

//get all tasks with filters

router.post(
  "/get_all_tasks",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("get all tasks route hit");
    let data = req.body;
    const { error } = validations.get_all_tasks(data);
    if (error) return res.status(400).send(error.details[0].message);

    const limit = 40;
    const skip = data.skip; // Fixed limit value
    const userRole = req.employee.admin_type;

    let query = {
      organisation_id: req.employee.organisation_id,
    };
    if (userRole === "2") {
      if (data.status) {
        query.status = data.status;
      }

      if (data.date) {
        const date = new Date(data.date);
        const start_day = new Date(date.setHours(0, 0, 0, 0));
        const end_day = new Date(date.setHours(23, 59, 59, 999));
        query.createdAt = {
          $gte: start_day, // Greater than or equal to start of the day
          $lte: end_day, // Less than end of the day
        };
      }
    } else if (userRole === "3") {
      // query["created_by.employee_id"] = req.employee.employee_id;
      query = {
        $or: [
          { "created_by.employee_id": req.employee.employee_id }, // Tasks created by the employee
          { team: { $elemMatch: { employee_id: req.employee.employee_id } } }, // Tasks where employee is in the team array
        ],
      };

      if (data.status) {
        query.status = data.status;
      }

      if (data.date) {
        const date = new Date(data.date);
        const start_day = new Date(date.setHours(0, 0, 0, 0));
        const end_day = new Date(date.setHours(23, 59, 59, 999));
        query.createdAt = {
          $gte: start_day, // Greater than or equal to start of the day
          $lt: end_day, // Less than end of the day
        };
      }
    } else {
      // query.status = { $nin: [/^completed$/i, /^under_review$/i] };
      query.team = { $elemMatch: { employee_id: req.employee.employee_id } };
      // { $elemMatch: { employee_id: req.employee.employee_id } };

      if (data.status) {
        query.status = data.status;
      }

      if (data.date) {
        const date = new Date(data.date);
        const start_day = new Date(date.setHours(0, 0, 0, 0));
        const end_day = new Date(date.setHours(23, 59, 59, 999));
        query.team = {
          $elemMatch: {
            employee_id: req.employee.employee_id,
            date_time: {
              $gte: start_day, // Greater than or equal to the start of today
              $lt: end_day, // Less than the end of today
            },
          },
        };
      }
    }

    // Find tasks using the query object
    const findTask = await mongoFunctions.lazy_loading(
      "TASKS",
      query,
      { _id: 0, __v: 0 },
      { createdAt: -1 },
      limit,
      skip
    );
    console.log("all tasks fetched successfully");

    return res.status(200).send(findTask);
  })
);
module.exports = router;

router.post(
  "/leave_applications",
  Auth,
  slowDown,
  Async(async (req, res) => {
    console.log("leave applications route hit");
    let data = req.body;
    const { error } = validations.get_employee_leave_applications(data);
    if (error) return res.status(400).send(error.details[0].message);
    let query = {
      employee_id: req.employee.employee_id,
      organisation_id: req.employee.organisation_id,
      leave_status: "Pending",
    };

    // Optional fields
    if (data.leave_status && data.leave_status.length > 4) {
      query.leave_status = data.leave_status;
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
    console.log(query);
    let leaveApplications = await mongoFunctions.lazy_loading(
      "LEAVE",
      query,
      {
        __v: 0,
      },
      { _id: -1 },
      { limit: 40 },
      { skip: data.skip }
    );
    console.log("leave applications fetched successfully");
    return res.status(200).send(leaveApplications);
  })
);

//employee total attendance

router.post(
  "/get_total_attendance_by_employee",
  Auth,
  slowDown,
  Async(async (req, res) => {
    const user = req.employee;
    let data = req.body;
    var { error } = validations.get_emp_attendance_by_filter(data);
    if (error) return res.status(400).send(error.details[0].message);
    let condition = {
      organisation_id: user.organisation_id,
      employee_id: user.employee_id,
    };

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

router.post(
  "/download_xl_of_emp",
  Auth,
  slowDown,
  Async(async (req, res) => {
    try {
      const data = await mongoFunctions.find(
        "EMPLOYEE",
        { organisation_id: req.employee.organisation_id },
        { _id: -1 },
        { _id: 0, __v: 0, "images.dp": 0 }
      );

      if (!data || data.length === 0) {
        return res.status(404).send("No employee data found.");
      }

      console.log(data);

      const excelData = data.map((data) => ({
        organisation_id: data.organisation_id || "",
        organisation_name: data.organisation_name || "",
        employee_id: data.employee_id || "",
        password: data.password || "",
        first_name: data.basic_info?.first_name || "",
        last_name: data.basic_info?.last_name || "",
        nick_name: data.basic_info?.nick_name || "",
        email: data.basic_info?.email || "",
        gender: data.personal_details?.gender || "",
        department_id: data.work_info?.department_id || "",
        department_name: data.work_info?.department_name || "",
        admin_type: data.work_info?.admin_type || "",
        employment_type: data.work_info?.employment_type || "",
        employee_status: data.work_info?.employee_status || "",
        designation_id: data.work_info?.designation_id || "",
        designation_name: data.work_info?.designation_name || "",
        source_of_hire: data.work_info?.source_of_hire || "",
        reporting_manager: data.work_info?.reporting_manager || "",
        date_of_join: data.work_info?.date_of_join || "",
        role_id: data.work_info?.role_id || "",
        role_name: data.work_info?.role_name || "",
        date_of_join: data.work_info?.date_of_join || "",
        mobile_number: data.contact_details?.personal_mobile_number || "",
        work_phone_number: data.contact_details?.work_phone_number || "",
        date_of_birth: data.personal_details?.date_of_birth || "",
        marital_status: data.personal_details?.marital_status || "",
        about_me: data.personal_details?.about_me || "",
        uan: data.identity_info?.uan || "",
        pan: data.identity_info?.pan || "",
        aadhaar: data.identity_info?.aadhaar || "",
        passport: data.identity_info?.passport || "",
        present_address: data.contact_details?.present_address || "",
        permanent_address: data.contact_details?.permanent_address || "",
        expertise: data.personal_details?.expertise || "",
        // Leaves: data.leaves?.map((leave) => leave.leave_name).join(", ") || "",
      }));

      const validExcelData = excelData.filter(
        (record) => record["employee_id"]
      );

      const worksheet = XLSX.utils.json_to_sheet(validExcelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

      res.set({
        "Content-Disposition": "attachment; filename=employees.xlsx",
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      res.send(buffer);
    } catch (error) {
      console.error("Error generating Excel file:", error);
      res.status(500).send("Internal Server Error");
    }
  })
);

const upload = multer({ dest: "uploads/" });

router.post(
  "/add_emp_from_xl",
  Auth,
  upload.single("Employees"),
  Async(async (req, res) => {
    try {
      console.log("Uploaded file:", req.file.filename);

      if (!req.file) {
        return res.status(400).send("No File Uploaded.");
      }
      console.log(req.file);

      // Read the uploaded Excel file
      const workbook = XLSX.readFile(req.file.path);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      console.log(jsonData);

      // Check if the user is authorized
      const org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
        true
      );
      if (!org_data) return res.status(400).send("Access Denied..!");

      const admin_types = ["1", "2"];
      if (!admin_types.includes(req.employee.admin_type)) {
        return res
          .status(403)
          .send("Only Admin Or Manager Can Add New Employee");
      }

      for (const data of jsonData) {
        // Validate each row of data
        const { error } = validations.add_employee_by_admin(data);
        if (error)
          return res
            .status(400)
            .send(`Validation error: ${error.details[0].message}`);

        let department_data = org_data.departments.find(
          (e) => e.department_id === data.department_id
        );
        if (!department_data)
          return res.status(400).send("Invalid Department ID in Excel file.");

        let role_data = org_data.roles.find((e) => e.role_id === data.role_id);
        if (!role_data)
          return res.status(400).send("Invalid Role ID in Excel file.");

        let designation_data = org_data.designations.find(
          (e) => e.designation_id === data.designation_id
        );
        if (!designation_data)
          return res.status(400).send("Invalid Designation ID in Excel file.");

        const employees = await mongoFunctions.find("EMPLOYEE", {
          organisation_id: req.employee.organisation_id,
        });

        if (employees.length < 2 && role_data.admin_type !== "2") {
          return res
            .status(400)
            .send(
              "Director Must Have Added At Least One Manager Before Adding Another Employee."
            );
        }

        // Manager restrictions
        if (req.employee.admin_type === "2" && role_data.admin_type === "2") {
          if (data.role_id === role_data.role_id) {
            return res
              .status(400)
              .send("A Manager Cannot Add Another Manager.");
          }
        }

        if (
          !Array.isArray(data.educational_details) ||
          data.educational_details.length === 0
        ) {
          return res
            .status(400)
            .send("Educational Details Must be Filled in Excel file.");
        }

        // Check for existing employee
        let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
          $or: [
            { employee_id: data.employee_id.toUpperCase() },
            { "basic_info.email": data.email.toLowerCase() },
          ],
        });

        if (find_emp) {
          return res
            .status(400)
            .send("Employee ID or Email already exists in the database.");
        }

        // Create new employee record
        const new_password = data.password;
        const password_hash = await bcrypt.hash_password(new_password);
        const new_emp_data = {
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
            role_data.leaves?.map((e) => ({
              ...e,
              used_leaves: 0,
              remaining_leaves: e.total_leaves,
            })) || [],
          images: {},
          files: {},
        };

        const new_emp = await mongoFunctions.create_new_record(
          "EMPLOYEE",
          new_emp_data
        );
        if (!new_emp) {
          return res.status(400).send("Failed To Add New Employee.");
        }
      }

      return res.status(200).send({
        success: "Employees Added Successfully..!!",
      });
    } catch (error) {
      console.error("Error adding employees from Excel:", error);
      res.status(500).send("Internal Server Error");
    }
  })
);

router.post(
  "/today_attendance",
  Auth,
  slowDown,
  Async(async (req, res) => {
    const employee = await mongoFunctions.find_one("EMPLOYEE", {
      organisation_id: req.employee.organisation_id,
      employee_id: req.employee.employee_id,
    });
    if (!employee) {
      return res.status(400).send("Employee Not Found");
    }
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
    return res.status(200).send(today_attendance);
  })
);
