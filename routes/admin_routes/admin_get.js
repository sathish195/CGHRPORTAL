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
      if (emp_find.role_name.toLowerCase()=== "director") {
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
  .post(
    "/get_employee_list",
    Auth,(async (req, res) => {
      const emp = req.employee;
      const LIMIT = 50;
      let data = req.body;
      var { error } = validations.skip(data);
      if (error) return res.status(400).send(error.details[0].message);
      if (emp.role_name.toLowerCase() !== "director" && emp.role_name.toLowerCase() !== "manager" ) return res.status(400).send("Not Admin");
      let employees = await mongoFunctions.lazy_loading(
        "EMPLOYEE",
        { organisation_id: emp.organisation_id },
        { two_fa_key: 0, fcm_token: 0, browserid: 0, others: 0 },
        { _id: 1 },
        LIMIT,
        data.skip
      );
      return res.status(200).send({employees});
    })
  )
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
                team: { $elemMatch: { employee_id: employeeId } }
            });
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
                team: { $elemMatch: { employee_id: employeeId } }
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

  module.exports =router;