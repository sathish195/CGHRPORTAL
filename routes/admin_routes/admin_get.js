const express = require('express');
const mongoFunctions = require('../../helpers/mongoFunctions');
const router=express.Router();
const validations=require('../../helpers/schema');
const bcrypt=require('../../helpers/crypto');
const jwt=require('jsonwebtoken');
const { Auth } = require("../../middlewares/auth");
const redis=require('../../helpers/redisFunctions');
const { mongo } = require('mongoose');

//get employee list

//------------------------get emp by id------------------
router.post(
    "/get_emp_by_id",
    Auth,(async (req, res) => {
      let data = req.body;
      var { error } = validations.employee_id(data);
      if (error) return res.status(400).send(error.details[0].message);
      const emp_find = req.employee;
      if (emp_find.role_name.toLowerCase()=== "director" || emp_find.role_name.toLowerCase()=== "manager" ) {
        let emp = await mongoFunctions.find_one(
          "EMPLOYEE",
          {
            organisation_id: emp_find.organisation_id,
            employee_id: data.employee_id,
          },
          { two_fa_key: 0, fcm_token: 0, browserid: 0, undatedAt: 0 }
        );
        return res.status(200).send({ employee: emp });
      }
      return res.status(400).send("Not Admin");
    })
  )
  //-----------------get emp by lazy loading--------
  router.post(
    "/get_employee_list",
    Auth,
    async (req, res) => {
        const emp = req.employee;
        const LIMIT = 50;
        const data = req.body;
        const { error } = validations.skip(data);

        if (error) return res.status(400).send(error.details[0].message);

        if (emp.role_name.toLowerCase() === "director" || emp.role_name.toLowerCase() === "manager") {
            // Logic for director or manager
            let employees = await mongoFunctions.lazy_loading(
                "EMPLOYEE",
                { organisation_id: emp.organisation_id },
                { two_fa_key: 0, fcm_token: 0, browserid: 0, others: 0 },
                { _id: -1 },
                LIMIT,
                data.skip
            );
            return res.status(200).send({ employees });
        } else if (emp.role_name.toLowerCase() === "team incharge") {
            // Logic for team incharge
            const find_employees = await mongoFunctions.aggregate(
                "EMPLOYEE",
                [
                    {
                        $match: {
                            organisation_id: emp.organisation_id,
                            employee_id: { $ne: emp.employee_id },
                            "work_info.department_id": emp.department_id,
                        }
                    },
                    {
                        $project: {
                            employee_id: 1,
                            "basic_info.first_name": 1,
                            "basic_info.last_name": 1,
                            "work_info.department_name": 1,
                            "work_info.department_id": 1,
                            _id: 0 // Exclude _id field
                        }
                    }
                ]
            );

            if (!find_employees || find_employees.length === 0) {
                return res.status(400).send("No Employees Found in the Given Department");
            }

            return res.status(200).send(find_employees);
        } else {
            return res.status(403).send("Forbidden: Not Administrator");
        }
    }
);

  router.post("/get_project_by_id",Auth, async (req, res)=>{
    data=req.body;
    var { error } =validations.get_project_by_id(data);
      if (error) return res.status(400).send(error.details[0].message);
    
    // const userRole = req.employee.role_name.toLowerCase();
    // if (userRole === 'team member' ) {
    //   return res.status(403).send('Access denied: Not Admin');
    // }
    findProject=await mongoFunctions.find_one("PROJECTS",{organisation_id:req.employee.organisation_id,project_id:data.project_id});
    if(!findProject) return res.status(400).send("Project not found")
    return res.status(200).send(findProject)

    });

    router.post("/get_projects",Auth, async (req, res)=>{

    const data = req.body;
    const userRole = req.employee.role_name.toLowerCase();
    console.log(userRole);
    const organisationId = req.employee.organisation_id;
    const employeeId = req.employee.employee_id;

    // Check user role
    // if (userRole === 'team member') {
    //     return res.status(403).send('Access denied: Not authorized');
    // }

    if (userRole === 'director' || userRole === 'manager') {
        // Get all projects for director or manager
        try {
            const projects = await mongoFunctions.find('PROJECTS', { organisation_id: organisationId });
            console.log(projects);
            return res.status(200).send(projects);
        } catch (err) {
            return res.status(500).send('Server error');
        }
    } else if (userRole === 'team incharge') {
        // Get only the projects where the team incharge's employee ID is in the team array
        try {
            const projects = await mongoFunctions.find('PROJECTS', {
                organisation_id: organisationId,
                team: { $elemMatch: { employee_id: employeeId }},
                // 
               }
            );
            return res.status(200).send(projects);
        } catch (err) {
            return res.status(500).send('Server error');
        }
    } else {
      // const projects = await mongoFunctions.find('TASKS', {
      //   organisation_id: organisationId,
      //   team: { $elemMatch: { employee_id: employeeId } }
      const projects = await mongoFunctions.aggregate('TASKS', [
        {
            $match: {
                organisation_id: organisationId,
                team: { $elemMatch: { employee_id: employeeId }},
                // { $elemMatch: { employee_id: employeeId }
               
            }
        },
        {
            $project: {
                _id: 0, 
                project_id: 1, 
                project_name: 1 
            }
        },
        {
            $group: {
                _id: "$project_id", 
                project_name: { $first: "$project_name" } 
            }
        },
        {
            $project: {
                _id: 0, 
                project_id: "$_id", 
                project_name: 1 
            }
        }
    ]);

    // });
    return res.status(200).send(projects);
    }
});
router.post("/all_leave_applications", Auth, async (req, res) => {
  try {
    const data = req.body;
    const { error } = validations.get_all_leave_applications(data);

    if (error) {
      return res.status(400).send(error.details[0].message);
    }

    const roleName = req.employee.role_name.toLowerCase();
    const status = "Pending";
    const query = {
      organisation_id: req.employee.organisation_id,
      employee_id: { $ne: req.employee.employee_id },
      // "approved_by.team_incharge.leave_status": status
    };

    // Role-based access control
    if (roleName === 'team member') {
      return res.status(403).send("Access denied: Not Admin");
    } 

    if (roleName === 'director') {
      query.leave_status = status;
      // No additional conditions for 'director'
    } else if (roleName === 'manager' && req.employee.designation_id === 'hr manager') {
      query.leave_status = status;
    }else if (roleName === 'manager') {
      query.reporting_manager = req.employee.email;
      query["approved_by.manager.leave_status"] = status;
    }else if (roleName === 'team incharge') {
      query.department_id=req.employee.department_id;
      // Optionally add conditions specific to 'team incharge'
      query["approved_by.team_incharge.leave_status"] = status;
    } else {
      return res.status(403).send("Access denied: Invalid role");
    }

    // Add optional fields to the query
    if (data.employee_id && data.employee_id.length > 5) {
      query.employee_id = data.employee_id;
    }

    if (data.from_date && data.to_date) {
      const fromDate = new Date(data.from_date);
      const toDate = new Date(data.to_date);

      // Validate date formats
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).send("Invalid date format");
      }

      // Ensure toDate is inclusive of the end of the day
      toDate.setUTCHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: fromDate,
        $lte: toDate
      };
    }

    if (data.leave_status && data.leave_status.length > 5) {
      if (roleName === 'manager') {
        query["approved_by.manager.leave_status"] = data.leave_status;
      } else if (roleName === 'team incharge') {
        query["approved_by.team_incharge.leave_status"] = data.leave_status;
      }
      else{
        query.leave_status = data.leave_status;

      }
    }

    // Fetch leave applications with pagination
    const leaveApplications = await mongoFunctions.lazy_loading(
      "LEAVE",
      query,
      { __v: 0 },
      { _id: -1 },
      { limit: 40 },
      { skip: data.skip || 0 } // Default skip to 0 if not provided
    );
    console.log(query);

    return res.status(200).send(leaveApplications);

  } catch (err) {
    console.error("Error fetching leave applications:", err);
    return res.status(500).send("Internal server error");
  }
});










  module.exports =router;