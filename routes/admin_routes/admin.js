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

  router.post('/add_update_project',Auth, async (req, res) => {
    const data = req.body;
  
    // Validate request data
    const { error } = validations.add_project(data);
    if (error) return res.status(400).send(error.details[0].message);
  
    // Check user role
    const userRole = req.employee.role_name.toLowerCase();
    if (userRole !== 'director' && userRole !== 'manager') {
      return res.status(403).send('Access denied: Not Admin');
    }
  
    if (data.project_id && data.project_id.length > 9) {
      // Check if project ID exists
      const findId = await mongoFunctions.find_one('PROJECTS', {
        organisation_id: req.employee.organisation_id,
        project_id: data.project_id,
      });
  
      if (!findId) return res.status(400).send('Project ID does not exist');
  
   
      // Update project
      const project_data_up = await mongoFunctions.find_one_and_update(
        'PROJECTS',
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
                    employee_email: req.employee.email,
                    modifiedAt: new Date(),
                    prevStatus: findId.status,
                    currentStatus: data.status,
                  },
                },
              },
              { new: true } // Optionally return the updated document
            );
  
      if (!project_data_up) return res.status(400).send('Project Update Failed');
  
      return res.status(200).send('Project Updated Successfully');
    } else {
      // Check if project name already exists
      const findProject = await mongoFunctions.find_one('PROJECTS', {
        project_name: data.project_name.toLowerCase(),
      });
  
      if (findProject) return res.status(400).send('Project Name Already Exists');
  
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
          email: req.employee.email,
        },
      };
  
      // Create new project
      await mongoFunctions.create_new_record('PROJECTS', new_project_data);
  
      return res.status(201).send('Project created successfully');
    }
  });

  router.post('/add_remove_team', Auth, async (req, res) => {
    const data = req.body;

    // Validate request data
    const { error } = validations.add_remove_team(data);
    if (error) return res.status(400).send(error.details[0].message);

    // Ensure project_id is provided
    // if (!data.project_id) {
    //     return res.status(400).send('Project ID is required');
    // }

    // Check user role based on task_id or project_id
    const userRole = req.employee.role_name.toLowerCase();

    // Check if task_id is provided
    if (data.task_id) {
      if (data.task_id.length === 0) {
          // If task_id is empty, only directors and managers can modify project team
          if (userRole !== 'director' && userRole !== 'manager') {
              return res.status(403).send('Access denied: Not authorized');
          }
      } else if (data.task_id.length > 9) {
          // If task_id is provided and length > 9, only team incharges can modify task team
          if (userRole !== 'team incharge') {
              return res.status(403).send('Access denied: Not authorized');
          }
      } else {
          return res.status(400).send('Invalid task_id length');
      }
  } else {
      // If no task_id is provided, ensure team incharges are denied access
      if (userRole === 'team incharge') {
          return res.status(403).send('Access denied: Not authorized');
      }
  }

    // Find the employee
    const employee = await mongoFunctions.find_one('EMPLOYEE', { employee_id: data.employee_id });
    if (!employee) return res.status(400).send('Employee not found');

    // Find the project
    const project = await mongoFunctions.find_one('PROJECTS', { project_id: data.project_id });
    if (!project) return res.status(400).send('Project not found');

    // Check if task_id is provided and belongs to the project
    const task = await mongoFunctions.find_one('TASKS', { task_id: data.task_id, project_id: data.project_id });
    if (data.task_id.length>9) {
        // const task = await mongoFunctions.find_one('TASKS', { task_id: data.task_id, project_id: data.project_id });
        if (!task) return res.status(400).send('Task does not belong to the project');
    }


    // Prepare the new team member and assign track objects
    const new_team_member = {
        employee_id: data.employee_id,
        employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
    };

    const assign_track = {
        assigned_by: {
            employee_id: req.employee.employee_id,
            employee_email: req.employee.email,
            date_time: new Date(),
        },
        assigned_to: {
            employee_id: data.employee_id,
            employee_name: `${employee.basic_info.first_name} ${employee.basic_info.last_name}`,
            date_time: new Date(),
        },
    };
   
    
    if (data.status.toLowerCase() === 'add') {
        if (data.task_id.length>9) {
            // Add team member to task
            // if (task && task.length>0){
            const isEmployeeInTeam = task.team.some(member => member.employee_id === data.employee_id);
            if (isEmployeeInTeam) {
              return res.status(400).send('Employee is already added to the task team');
            }
            // };
            await mongoFunctions.find_one_and_update(
                'TASKS',
                { project_id: data.project_id, task_id: data.task_id },
                { $push: { team: new_team_member, assign_track: assign_track } }
            );
            return res.status(200).send('Team member added to task successfully');
        } else {
            // Add team member to project
            const isEmployeeInProject = project.team.some(member => member.employee_id === data.employee_id);
            if (isEmployeeInProject) {
              return res.status(400).send('Employee is already added to the project team');
            }
            await mongoFunctions.find_one_and_update(
                'PROJECTS',
                { project_id: data.project_id },
                { $push: { team: new_team_member, assign_track: assign_track } }
            );
            return res.status(200).send('Team member added to project successfully');
        }
    } else if (data.status.toLowerCase() === 'remove') {
        if (data.task_id.length>9) {
            // Remove team member from task
            await mongoFunctions.find_one_and_update(
                'TASKS',
                { project_id: data.project_id, task_id: data.task_id },
                { $pull: { team: { employee_id: data.employee_id } } }
            );
            return res.status(200).send('Team member removed from task successfully');
        } else {
            // Remove team member from project
            await mongoFunctions.find_one_and_update(
                'PROJECTS',
                { project_id: data.project_id },
                { $pull: { team: { employee_id: data.employee_id } } }
            );
            return res.status(200).send('Team member removed from project successfully');
        }
    } else {
        return res.status(400).send('Invalid status');
    }
});
  
  module.exports=router;


  router.post('/add_update_task',Auth, async (req, res) => {
    const data = req.body;
  
    // Validate request data
    const { error } = validations.add_update_task(data);
    if (error) return res.status(400).send(error.details[0].message);
  
    // Check user role
    const userRole = req.employee.role_name.toLowerCase();
    if (userRole !== 'team incharge') {
      return res.status(403).send('Access denied: Not Team Incharge');
    }
    const findId = await mongoFunctions.find_one('PROJECTS', {
      organisation_id: req.employee.organisation_id,
      project_id: data.project_id,
    });

    if (!findId) return res.status(400).send('Project ID does not exist');

  
    if (data.task_id && data.task_id.length > 9) {
      // Check if task ID exists
      const findId = await mongoFunctions.find_one('TASKS', {
        organisation_id: req.employee.organisation_id,
        task_id: data.task_id,
      });
  
      if (!findId) return res.status(400).send('Task ID does not exist');
  
   
      // Update task
      const task_data_up = await mongoFunctions.find_one_and_update(
        'TASKS',
        {
          organisation_id: req.employee.organisation_id,
          task_id: data.task_id,
        },
            {
                $set: {
                  task_name: data.task_name.toLowerCase(),
                  status: data.status,
                  description: data.description,
                  task_status: data.task_status,
                  completed_date: data.completed_date ? data.completed_date : new Date() ,
                },
                $push: {
                  modified_by: {
                    employee_id: req.employee.employee_id,
                    employee_email: req.employee.email,
                    modifiedAt: new Date(),
                    prevStatus: findId.status,
                    currentStatus: data.status,
                  },
                },
              },
              { new: true } // Optionally return the updated document
            );
  
      if (!task_data_up) return res.status(400).send('Task Update Failed');
  
      return res.status(200).send('Task Updated Successfully');
    } else {
      // Check if task name already exists
      const findTask = await mongoFunctions.find_one('TASKS', {
        task_name: data.task_name.toLowerCase(),
      });
  
      if (findTask) return res.status(400).send('Task Name Already Exists');
  
      const new_task_data = {
        organisation_id: req.employee.organisation_id,
        task_id: functions.get_random_string("TA", 9, true),
        project_id: data.project_id,
        project_name:findId.project_name,
        task_name: data.task_name.toLowerCase(),
        // start_date: data.start_date,
        // end_date: data.end_date,
        description: data.description,
        status: data.status,
        task_status: data.task_status,
        created_by: { 
          employee_id: req.employee.employee_id,
          email: req.employee.email,
        },
      };
  
      // Create new project
      await mongoFunctions.create_new_record('TASKS', new_task_data);
  
      return res.status(201).send('Task Created successfully');
    }
  });

  router.post("/update_project",Auth,async(req, res)=>{
    const data = req.body;
    const { error } = validations.update_project(data);
    if(error) return res.status(400).send(error.details[0].message);
    const userRole = req.employee.role_name.toLowerCase();
    if(userRole!=='team incharge'){
      return res.status(403).send('Access denied: Not Team Incharge');
    }
    const findId = await mongoFunctions.find_one('PROJECTS',{
      organisation_id: req.employee.organisation_id,
      project_id: data.project_id
    });
    if(!findId) return res.status(400).send('Project ID does not exist');
    const project_data_up = await mongoFunctions.find_one_and_update(
      'PROJECTS',
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
                  employee_email: req.employee.email,
                  modifiedAt: new Date(),
                  prevStatus: findId.status,
                  currentStatus: data.status,
                },
              },
            },
            { new: true } // Optionally return the updated document
          );
          if(!project_data_up) return res.status(400).send('Project Update Failed');
          return res.status(200).send('Project Updated Successfully');
  });



