const express = require('express');
const mongoFunctions = require('../../helpers/mongoFunctions');
const router=express.Router();
const validations=require('../../helpers/schema');
const bcrypt=require('../../helpers/crypto');
const jwt=require('jsonwebtoken');
const { Auth } = require("../../middlewares/auth");
const redis=require('../../helpers/redisFunctions');
const stats=require('../../helpers/stats');
const functions=require('../../helpers/functions');
const { date } = require('joi');

// Add new employee

router.post(
    "/add_employee",
    Auth,(async (req, res) => {
      let data = req.body;
      var { error } = validations.add_employee_by_admin(data);
      if (error) return res.status(400).send(error.details[0].message);
      let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
        true
      );
      if (!org_data) return res.status(400).send("Access Denied..!");
      if (req.employee.role_name.toLowerCase() !== "director" && req.employee.role_name.toLowerCase() !== "manager"){
        return res.status(400).send("Only Director Manager Can Add New Employee..!");
      }
    
      let department_data = org_data.departments.find(
        (e) => e.department_id === data.department_id
      );
      if (!department_data)
        return res.status(400).send("Invalid Department id..!");

      let role_data = org_data.roles.find(
        (e) => e.role_id === data.role_id
      );
      if (!role_data) return res.status(400).send("Invalid Role id..!");

      let designation_data = org_data.designations.find(
        (e) => e.designation_id === data.designation_id
      );
      if (!designation_data)
        return res.status(400).send("Invalid Designation id..!");
      let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
        $or: [
          {
            employee_id: data.employee_id.toUpperCase(),
            organisation_id: org_data.organisation_id,
          },
          {
            "basic_info.email":
              data.email,
            organisation_id: org_data.organisation_id,
          },
        ],
      });
      if (
        find_emp &&
        find_emp.basic_info.email ===
          data.email
      )
        return res.status(400).send("Email Id Already Exists");
      if (find_emp && find_emp.employee_id === data.employee_id.toUpperCase())
        return res.status(400).send("Employee Id Already Exists");
      let find_email = await mongoFunctions.find_one("EMPLOYEE", {

            "contact_details.personal_email_address": data.personal_email_address.toLowerCase(),
            organisation_id: org_data.organisation_id,
      });
      if (find_email)
        return res.status(400).send("Personal Email Id Already Exists");
      const new_password="Emp@1234";
      let password_hash = await bcrypt.hash_password(new_password);
      let new_emp_data = {
        organisation_id: org_data.organisation_id,
        organisation_name: org_data.organisation_name,
        employee_id: data.employee_id.toUpperCase(),
        password:password_hash,
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
          work_phone_number: data.work_phone_number,
          personal_mobile_number: data.personal_mobile_number,
          personal_email_address: data.personal_email_address.toLowerCase(),
          seating_location: data.seating_location,
          present_address: data.present_address,
          permanent_address: data.permanent_address,
        },
        work_experience: data.work_experience,
        educational_details: data.educational_details,
        dependent_details: data.dependent_details,
        leaves:
          designation_data.leaves && designation_data.leaves.length > 0
            ? designation_data.leaves.map((e) => ({
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

      //   await rediscon.update_redis("EMPLOYEE", new_emp);
    //   await stats.update_emp(new_emp, true, true);
      return res.status(200).send({
        success: "Success",
        // data: new_emp,
      });
    })
  )

  // Update employee profile
  router.post(
    "/update_employee_profile",
    Auth,(async (req, res) => {
      let data = req.body;
      var { error } = validations.add_employee_by_admin(data);
      if (error) return res.status(400).send(error.details[0].message);
      let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
        true
      );
      if (!org_data) return res.status(400).send("Access Denied..!");
      if (req.employee.role_name.toLowerCase() !== "director" && req.employee.role_name.toLowerCase() !== "manager"){
        return res.status(400).send("Only Director or Manager Can Update Status Of New Employee..!");
      }
      let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
    
        employee_id: data.employee_id.toUpperCase(),
        organisation_id: org_data.organisation_id,
        });
      if (!find_emp){
            return res.status(400).send("Employee Id Doesn't exists");
       }
    let existingEmployee = await mongoFunctions.find_one("EMPLOYEE", {
        $and: [
            { "contact_details.personal_email_address": data.personal_email_address },
            {"basic_info.email": data.email},
            { employee_id: { $ne: data.employee_id } }
        ]
    });
    if (existingEmployee) {
        if (existingEmployee.contact_details.personal_email_address === data.personal_email_address) {
            return res.status(400).send("Personal email address already exists for another employee.");
        }

        if (existingEmployee.basic_info.email === data.email) {
            return res.status(400).send("Email ID already exists for another employee.");
        }
    }
    
      let department_data = org_data.departments.find(
        (e) => e.department_id === data.department_id
      );
      if (!department_data)
        return res.status(400).send("Invalid Department id..!");

      let role_data = org_data.roles.find(
        (e) => e.role_id === data.role_id
      );
      if (!role_data) return res.status(400).send("Invalid Role id..!");

      let designation_data = org_data.designations.find(
        (e) => e.designation_id === data.designation_id
      );
      if (!designation_data)
        return res.status(400).send("Invalid Designation id..!");


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
          work_phone_number: data.work_phone_number,
          personal_mobile_number: data.personal_mobile_number,
          personal_email_address: data.personal_email_address.toLowerCase(),
          seating_location: data.seating_location,
          present_address: data.present_address,
          permanent_address: data.permanent_address,
        },
        work_experience: data.work_experience,
        educational_details: data.educational_details,
        dependent_details: data.dependent_details,
        leaves:
          designation_data.leaves && designation_data.leaves.length > 0
            ? designation_data.leaves.map((e) => ({
                ...e,
                used_leaves: 0,
                remaining_leaves: e.total_leaves,
              }))
            : [],
        images: {},
        files: {},
        permissions:{},
      };
      let new_emp = await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
       {employee_id: data.employee_id},
        { $set: new_emp_data },
      );

      //   await rediscon.update_redis("EMPLOYEE", new_emp);
    //   await stats.update_emp(new_emp, true, true);
      return res.status(200).send({
        success: "Success",
        // data: new_emp,
      });
    })
  )

  router.post('/add_project',Auth, async (req, res) => {
    const data = req.body;
  
    // Validate request data
    const { error } = validations.add_project(data);
    if (error) return res.status(400).send(error.details[0].message);
  
    // Check user role
    const userRole = req.employee.role_name.toLowerCase();
    if (userRole !== 'director' && userRole !== 'manager') {
      return res.status(403).send('Access denied: Not authorized');
    }
  
    if (data.project_id && data.project_id.length > 9) {
      // Check if project ID exists
      const findId = await mongoFunctions.find_one('PROJECTS', {
        organisation_id: req.employee.organisation_id,
        project_id: data.project_id,
      });
  
      if (!findId) return res.status(400).send('Project ID does not exist');
  
      const data_up = {
        start_date: data.start_date,
        project_name:data.project_name.toLowerCase(),
        end_date: data.end_date,
        status: data.status,
        description:data.description,
        project_status: data.project_status,
        team: data.team,
        $push: { 
          modifiedBy: {
            employee_id: req.employee.employee_id,
            employee_name: req.employee.first_name + ' ' + req.employee.last_name,
            modifiedAt: new Date(), 
            prevStatus: findId.status,
            currentStatus: data.status,
          },
        },
      };
  
      // Update project
      const project_data_up = await mongoFunctions.find_one_and_update(
        'PROJECTS',
        {
          organisation_id: req.employee.organisation_id,
          project_id: data.project_id,
        },
        {
          $set: data_up,
        }
      );
  
      if (!project_data_up) return res.status(400).send('Project update failed');
  
      return res.status(200).send('Project updated successfully');
    } else {
      // Check if project name already exists
      const findProject = await mongoFunctions.find_one('PROJECTS', {
        project_name: data.project_name.toLowerCase(),
      });
  
      if (findProject) return res.status(400).send('Project Name Already Exists');
  
      const new_project_data = {
        organisation_id: req.employee.organisation_id,
        project_id: functions.get_random_string("R", 10, true),
        project_name: data.project_name.toLowerCase(),
        start_date: data.start_date,
        end_date: data.end_date,
        description: data.description,
        status: data.status,
        project_status: data.project_status,
        team: data.team,
        createdBy: { 
          employee_id: req.employee.employee_id,
          employee_name: req.employee.email+ ' ' + req.employee.email,
        },
      };
  
      // Create new project
      await mongoFunctions.create_new_record('PROJECTS', new_project_data);
  
      return res.status(201).send('Project created successfully');
    }
  });
  
  module.exports=router;
