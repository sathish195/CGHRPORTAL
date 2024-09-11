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
const { RFC_2822 } = require('moment');
const Async = require("../../middlewares/async");
const rateLimit= require('../../helpers/custom_rateLimiter');


//forgot password
router.post('/emp_reset_password',Auth,rateLimit(60,10),Async(async(req,res) => {
  data=req.body;
  var {error}=validations.emp_reset_password_by_admin(data);
  if(error) return res.status(400).send(error.details[0].message);
  //validate data
  if (req.employee.admin_type !== "1" && req.employee.admin_type !== "2"){
    return res.status(400).send("Access Denied..!!Not Admin Or Manager");
  }
  // var {error}=validations.emp_reset_password_by_admin(data);
  // if(error) return res.status(400).send(error.details[0].message);
  const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email.toLowerCase()});
  if(!employee) return res.status(400).send('No Employee Found With The Given Email');
  
  if (
      // employee &&
      employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
      )
      return res
          .status(400)
          .send("Employee Status Disabled!");
    const verifyPassword=bcrypt.compare_password(data.new_password,employee.password);
    console.log(verifyPassword);
    console.log(employee.password);
    console.log(data.new_password);
    if(verifyPassword) return res.status(400).send('Password Should Not Same As Your Old Password');
    const hashedPassword=bcrypt.hash_password(data.new_password);
    await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        { employee_id: employee.employee_id },
        { password: hashedPassword }
    );
    return res.status(200).send({
    success: "Password Reset Done Successfully",
    });
  // var OTP="654321";
  // var otp=OTP;
  // await redis.genOtp(employee.employee_id, otp, 120);

  //send otp
  // return res.status(200).send({
  // success: "Success",
  // });  
}));
// Add new employee

router.post(
    "/add_employee",
    Auth,Async((async (req, res) => {
      let data = req.body;
      var { error } = validations.add_employee_by_admin(data);
      if (error) return res.status(400).send(error.details[0].message);
      let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
        true
      );
      if (!org_data) return res.status(400).send("Access Denied..!");
      if (req.employee.admin_type !== "1" && req.employee.admin_type !== "2"){
        return res.status(400).send("Only Director,Manager Can Add New Employee..!");
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
      // Check if the director has added at least one employee with the role "Manager"\\\\\\\\\
      // let managerAddedByDirector = await mongoFunctions.find_one("EMPLOYEE", {
      //   "work_info.reporting_manager": req.employee.email,
      // });

      // Ensure the reporting manager is the director and that the director has added at least one manager
      // if (data.reporting_manager !== req.employee.email) {
      //   return res.status(400).send("Director must have added at least one Manager before adding another employee.");
      // }
      employees=await mongoFunctions.find('EMPLOYEE',{organisation_id:req.employee.organisation_id})
      //
      if (employees.length<2 && role_data.admin_type!=="2") {
        return res.status(400).send("Director must have added at least one Manager before adding another employee.");
      }

      // Check if the current admin is a Manager
      if (req.employee.admin_type === "2" && role_data.admin_type=== "2") {
        // Managers cannot add other Managers
        if (data.role_id === role_data.role_id) {
          return res.status(400).send("A Manager cannot add another Manager.");
        }
      }
      let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
        $or: [
          {
                      employee_id: data.employee_id.toUpperCase()
          },
          {
            "basic_info.email":data.email.toLowerCase()
          },
        ]});

      if (find_emp&&find_emp.employee_id.toUpperCase()===data.employee_id.toUpperCase()) {
        return res.status(400).send("Employee Id Already Exists");
      }
      if (find_emp&& find_emp.basic_info.email && find_emp.basic_info.email.toLowerCase() === data.email.toLowerCase().trim()) {
        return res.status(400).send("Email Id Already Exists");
    }
           
          
      
      // Assuming mongoFunctions is properly imported and set up

      let find_adhar = await mongoFunctions.find_one("EMPLOYEE", {
        $or: [
            {
              "contact_details.personal_email_address": data.personal_email_address.toLowerCase(),
              // employee_id: { $ne: data.employee_id }
            },

          {
            "identity_info.pan": data.identity_info.pan,
                        // organisation_id: org_data.organisation_id,
          },
          {
            "identity_info.aadhaar":
              data.identity_info.aadhaar,
              // employee_id: { $ne: data.employee_id },
            // organisation_id: org_data.organisation_id,
          },
          {
            "identity_info.uan":
              data.identity_info.uan,
              // employee_id: { $ne: data.employee_id }
            // organisation_id: org_data.organisation_id,
          },
          {
            "identity_info.passport":
              data.identity_info.passport_number,
              // employee_id: { $ne: data.employee_id }
            // organisation_id: org_data.organisation_id,
          },
          {
            "contact_details.mobile_number": data.mobile_number,
            // employee_id: { $ne: data.employee_id }
          },
          // {"contact_details.personal_mobile_number": data.personal_mobile_number,
          //   // employee_id: { $ne: data.employee_id }
          // },
        ],
      });
      if (find_adhar) {
      //   if (find_adhar.employee_id && find_adhar.employee_id === data.employee_id) {
      //     return res.status(400).send("Employee Id Already Exists");
      // }
  
      // Check for duplicate personal email address in contact_details
      if (find_adhar.contact_details.personal_email_address && find_adhar.contact_details.personal_email_address.toLowerCase() === data.personal_email_address.toLowerCase().trim()) {
          return res.status(400).send("Personal Email Id Already Exists");
      }

        if (find_adhar.identity_info.aadhaar && find_adhar.identity_info.aadhaar.length > 0 && find_adhar.identity_info.aadhaar === data.identity_info.aadhaar) {
            return res.status(400).send("Aadhar Number Already Exists");
        }
        if (find_adhar.identity_info.uan && find_adhar.identity_info.uan.length > 0 && find_adhar.identity_info.uan === data.identity_info.uan) {
            return res.status(400).send("Uan Number Already Exists");
        }
  
        if (find_adhar.identity_info.passport_number && find_adhar.identity_info.passport_number.length > 0 && find_adhar.identity_info.passport_number === data.identity_info.passport_number) {
            return res.status(400).send("Passport Number Already Exists");
        }
    
        // if (find_adhar.contact_details.work_phone_number && find_adhar.contact_details.work_phone_number.length > 0 && find_adhar.contact_details.work_phone_number === data.work_phone_number) {
        //     return res.status(400).send("Work Phone Number Already Exists");
        // }
    
        if (find_adhar.contact_details.mobile_number && find_adhar.contact_details.mobile_number.length > 0 && find_adhar.contact_details.mobile_number === data.mobile_number) {
            return res.status(400).send("Mobile Number Already Exists");
        }
    
        if (find_adhar.identity_info.pan && find_adhar.identity_info.pan.length > 0 && find_adhar.identity_info.pan === data.identity_info.pan) {
            return res.status(400).send("PAN Number Already Exists");
        }
    }
      const new_password=data.password;
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

        await redis.update_redis("EMPLOYEE", new_emp);
        console.log("added emp in redis");
    //   await stats.update_emp(new_emp, true, true);
      return res.status(200).send({
        success: "Success",
        // data: new_emp,
      });
    })
  ))

  // Update employee profile
  router.post(
    "/update_employee_profile",
    Auth,rateLimit(60,10),Async((async (req, res) => {
      let data = req.body;
      var { error } = validations.add_employee_by_admin(data);
      if (error) return res.status(400).send(error.details[0].message);
      let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
        true
      );
      if (!org_data) return res.status(400).send("Access Denied..!");
      if (req.employee.admin_type !== "1" && req.employee.admin_type !== "2"){
        return res.status(400).send("Only Director or Manager Can Update Status Of New Employee..!");
      }
      let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
    
        employee_id: data.employee_id.toUpperCase(),
        // organisation_id: org_data.organisation_id,
        });
      if (!find_emp){
            return res.status(400).send("Employee Id Doesn't exists");
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
      let find_adhar = await mongoFunctions.find_one("EMPLOYEE", {
        $or: [
          {
            "basic_info.email":data.email.toLowerCase(),
            employee_id: { $ne: data.employee_id }
          },
            {
              "contact_details.personal_email_address": data.personal_email_address.toLowerCase(),
              employee_id: { $ne: data.employee_id }
              // employee_id: { $ne: data.employee_id }
            },

          {
            "identity_info.pan": data.identity_info.pan,
            employee_id: { $ne: data.employee_id }
                        // organisation_id: org_data.organisation_id,
          },
          {
            "identity_info.aadhaar":
              data.identity_info.aadhaar,
              employee_id: { $ne: data.employee_id },
            // organisation_id: org_data.organisation_id,
          },
          {
            "identity_info.uan":
              data.identity_info.uan,
              employee_id: { $ne: data.employee_id }
            // organisation_id: org_data.organisation_id,
          },
          {
            "identity_info.passport_number":
              data.identity_info.passport_number,
              employee_id: { $ne: data.employee_id }
            // organisation_id: org_data.organisation_id,
          },
          // {
          //   "contact_details.work_phone_number": data.work_phone_number,
          //   employee_id: { $ne: data.employee_id }
          // },
          {"contact_details.mobile_number": data.mobile_number,
            employee_id: { $ne: data.employee_id }
          },
        ],
      });
      if (find_adhar) {
        if (find_adhar.basic_info.email && find_adhar.basic_info.email.toLowerCase() === data.email.toLowerCase().trim()) {
          return res.status(400).send("Email Id Already Exists");
      }
  
      // Check for duplicate personal email address in contact_details
      if (find_adhar.contact_details.personal_email_address && find_adhar.contact_details.personal_email_address.toLowerCase() === data.personal_email_address.toLowerCase().trim()) {
          return res.status(400).send("Personal Email Id Already Exists");
      }

        if (find_adhar.identity_info.aadhaar && find_adhar.identity_info.aadhaar.length > 0 && find_adhar.identity_info.aadhaar === data.identity_info.aadhaar) {
            return res.status(400).send("Aadhar Number Already Exists");
        }
        if (find_adhar.identity_info.uan && find_adhar.identity_info.uan.length > 0 && find_adhar.identity_info.uan === data.identity_info.uan) {
            return res.status(400).send("Uan Number Already Exists");
        }
  
        if (find_adhar.identity_info.passport_number && find_adhar.identity_info.passport_number.length > 0 && find_adhar.identity_info.passport_number === data.identity_info.passport_number) {
            return res.status(400).send("Passport Number Already Exists");
        }
    
        // if (find_adhar.contact_details.work_phone_number && find_adhar.contact_details.work_phone_number.length > 0 && find_adhar.contact_details.work_phone_number === data.work_phone_number) {
        //     return res.status(400).send("Work Phone Number Already Exists");
        // }
    
        if (find_adhar.contact_details.mobile_number && find_adhar.contact_details.mobile_number.length > 0 && find_adhar.contact_details.mobile_number === data.mobile_number) {
            return res.status(400).send("Mobile Number Already Exists");
        }
    
        if (find_adhar.identity_info.pan && find_adhar.identity_info.pan.length > 0 && find_adhar.identity_info.pan === data.identity_info.pan) {
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
          role_data.leaves && role_data.leaves.length > 0
            ? role_data.leaves.map((e) => ({
                ...e,
                used_leaves: 0,
                remaining_leaves: e.total_leaves,
              }))
            : [],
        // images: {},
        // files: {},
        // permissions:{},
      };
      let new_emp = await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
       {employee_id: data.employee_id},
        { $set: new_emp_data },
      );

      // await redis.update_redis("EMPLOYEE", new_emp);
      // console.log("updated emp in redis");
    //   await stats.update_emp(new_emp, true, true);
      return res.status(200).send({
        success: "Success",
        // data: new_emp,
      });
    })
  ))

  router.post('/add_update_project',Auth,rateLimit(60,10), Async(async (req, res) => {
    const data = req.body;
  
    // Validate request data
    const { error } = validations.add_project(data);
    if (error) return res.status(400).send(error.details[0].message);
  
    // Check user role
    const userRole = req.employee.admin_type;
    if (userRole !== '1' && userRole !== '2') {
      return res.status(403).send('Access denied: Not Admin or Manager');
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
      let update_name_in_task = await mongoFunctions.update_many(
        "TASKS",
        { project_id: data.project_id },
        { $set: { project_name: data.project_name } }
      );
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
  }));

  router.post('/add_remove_team',Auth,rateLimit(60,10), Async(async (req, res) => {
    const data = req.body;

    // Validate request data
    const { error } = validations.add_remove_team(data);
    if (error) return res.status(400).send(error.details[0].message);

    // if (!data.project_id) {
    //     return res.status(400).send('Project ID is required');
    // }
    const userRole = req.employee.admin_type;

    if (data.task_id) {
        if (data.task_id.length === 0) {
            // If task_id is empty, only directors and managers can modify project team
            if (userRole !== '1' && userRole !== '2') {
                return res.status(403).send('Access denied: Not Authorized');
            }
        } else if (data.task_id.length > 9) {
            // If task_id is provided and length > 9, only team incharges can modify task team
            if (userRole !== '3' && userRole !== '2') {
                return res.status(403).send('Access denied: Not authorized');
            }
        } else {
            return res.status(400).send('Invalid task_id length');
        }
    } else {
        if (userRole === '3') {
            return res.status(403).send('Access denied: Not authorized');
        }
    }

    // Find the project
    const project = await mongoFunctions.find_one('PROJECTS', { project_id: data.project_id });
    if (!project) return res.status(400).send('Project not found');

    // Check if task_id is provided and belongs to the project
    if (data.task_id && data.task_id.length > 9) {
        const task = await mongoFunctions.find_one('TASKS', { task_id: data.task_id, project_id: data.project_id });
        if (!task) return res.status(400).send('Task does not belong to the project');
    }

    const employeeIds = Array.isArray(data.employee_id) ? data.employee_id : [data.employee_id];
    console.log(employeeIds);

    if (data.action.toLowerCase() === 'add') {
        for (const employeeId of employeeIds) {
          const employee=await mongoFunctions.find_one('EMPLOYEE', { employee_id: employeeId });
          if (!employee) return res.status(400).send(`Employee with ID ${employeeId} not found`);
            if (data.task_id && data.task_id.length > 9) {
                // Add team member to task
                const task = await mongoFunctions.find_one('TASKS', { project_id: data.project_id, task_id: data.task_id });
              //  if (task.team.some(member => member.employee_id === employeeId)) {
              //       return res.status(400).send(`Employee ${employeeId} is already added to the task team`);
              //   }
            const existingEmployeeIds = employeeIds.filter(employeeId =>
                task.team.some(member => member.employee_id === employeeId)
            );

            if (existingEmployeeIds.length > 0) {
                return res.status(400).send(`Employees with IDs ${existingEmployeeIds.join(', ')} are already added to the task team.`);
            }
                const team={
                  employee_id: employeeId,
                  employee_name:employee.basic_info.first_name + ' '+employee.basic_info.last_name,
                  date_time: new Date(),
                }
                

                const newAssignTrack = {
                    assigned_by: {
                        employee_id: req.employee.employee_id,
                        employee_email: req.employee.email,
                        date_time: new Date(),
                    },
                    assigned_to: {
                        employee_id: employeeId,
                        employee_name:employee.basic_info.first_name + ' '+employee.basic_info.last_name,
                        date_time: new Date(),
                    },
                };

                await mongoFunctions.find_one_and_update(
                    'TASKS',
                    { project_id: data.project_id, task_id: data.task_id },
                    { 
                        $push: { 
                            team: team,
                            assign_track: newAssignTrack 
                        }
                    }
                );
            } else {
                // Add team member to project
                // if (project.team.some(member => member.employee_id === employeeId)) {
                //     return res.status(400).send(`Employee ${employeeId} is already added to the project team`);
                // }
                const existingEmployeeIds = employeeIds.filter(employeeId =>
                  project.team.some(member => member.employee_id === employeeId)
              );
  
              if (existingEmployeeIds.length > 0) {
                  return res.status(400).send(`Employees with IDs ${existingEmployeeIds.join(', ')} are already added to the project team.`);
              }

                const newAssignTrack = {
                    assigned_by: {
                        employee_id: req.employee.employee_id,
                        employee_email: req.employee.email,
                        date_time: new Date(),
                    },
                    assigned_to: {
                        employee_id: employeeId,
                        employee_name:employee.basic_info.first_name + ' '+employee.basic_info.last_name,
                        date_time: new Date(),
                    },
                };
                const team={
                  employee_id: employeeId,
                  employee_name:employee.basic_info.first_name + ' '+employee.basic_info.last_name,
                  date_time: new Date(),
                }

                await mongoFunctions.find_one_and_update(
                    'PROJECTS',
                    { project_id: data.project_id },
                    { 
                        $push: { 
                            team: team,
                            assign_track: newAssignTrack 
                        }
                    }
                );
            }
        }

        return res.status(200).send('Team added successfully');
    } else if (data.action.toLowerCase() === 'remove') {
        for (const employeeId of employeeIds) {
            if (data.task_id && data.task_id.length > 9) {
                // Remove team member from task
                await mongoFunctions.find_one_and_update(
                    'TASKS',
                    { project_id: data.project_id, task_id: data.task_id },
                    { $pull: { team: { employee_id: employeeId } } }
                );
            } else {
                // Remove team member from project
                await mongoFunctions.find_one_and_update(
                    'PROJECTS',
                    { project_id: data.project_id },
                    { $pull: { team: { employee_id: employeeId } } }
                );
            }
        }

        return res.status(200).send('Team member removed successfully');
    } else {
        return res.status(400).send('Invalid action');
    }
}));

  
module.exports=router;


  router.post('/add_update_task',Auth,rateLimit(60,10), Async(async (req, res) => {
    const data = req.body;
  
    // Validate request data
    const { error } = validations.add_update_task(data);
    if (error) return res.status(400).send(error.details[0].message);
  
    // Check user role
    const userRole = req.employee.admin_type;
    if (userRole !== '3' && userRole !== '2') {
      return res.status(403).send('Access denied: Not Team Incharge Or Manager');
    }
    const findId = await mongoFunctions.find_one('PROJECTS', {
      organisation_id: req.employee.organisation_id,
      project_id: data.project_id,
      // team: { $elemMatch: { employee_id: req.employee.employee_id } }
    });
  
    if (userRole === '3') {
      const findId = await mongoFunctions.find_one('PROJECTS', {
        organisation_id: req.employee.organisation_id,
        project_id: data.project_id,
        team: { $elemMatch: { employee_id: req.employee.employee_id } }
        // req.employee.employee_id,
        // { $elemMatch: { employee_id: req.employee.employee_id } }
      });

    if (!findId) return res.status(400).send('Project ID does not exist');
  }

  
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
                  due_date: data.due_date,
                  priority: data.priority,
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
      if (findId.status !== data.status) {
        const s = await stats.update_stats(req.employee.employee_id, req.employee.organisation_id,findId.status, task_data_up.status);
        console.log(s);
      }
  
  
      return res.status(200).send('Task Updated Successfully');
    } else {
      // Check if task name already exists
      // const findTask = await mongoFunctions.find_one('TASKS', {
      //   task_name: data.task_name.toLowerCase(),
      // });
  
      // if (findTask) return res.status(400).send('Task Name Already Exists');
  
      const new_task_data = {
        organisation_id: req.employee.organisation_id,
        task_id: functions.get_random_string("TA", 9, true),
        project_id: data.project_id,
        project_name:findId.project_name,
        task_name: data.task_name.toLowerCase(),
        // start_date: data.start_date,
        // end_date: data.end_date,
        description: data.description,
        due_date: data.due_date,
        priority: data.priority,
        status: data.status,
        task_status: data.task_status,
        created_by: { 
          employee_id: req.employee.employee_id,
          email: req.employee.email,
        },
      };
  
      // Create new project
      await mongoFunctions.create_new_record('TASKS', new_task_data);
      await stats.add_stats(req.employee.employee_id, req.employee.organisation_id,new_task_data.status);
  
      return res.status(201).send('Task Created successfully');
    }
  }));
  router.post("/update_project",Auth,rateLimit(60,10),Async(async(req, res)=>{
    const data = req.body;
    const { error } = validations.update_project(data);
    if(error) return res.status(400).send(error.details[0].message);
    const userRole = req.employee.admin_type;
    if(userRole!=='3'){
      return res.status(403).send('Access denied: Not Team Incharge');
    }
    const findId = await mongoFunctions.find_one('PROJECTS',{
      organisation_id: req.employee.organisation_id,
      project_id: data.project_id,
      team: { $elemMatch: { employee_id: req.employee.employee_id } }
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
  }));

  router.post("/update_leave_application",Auth,rateLimit(60,10),Async(async(req, res) => {
    const data = req.body;
    const { error } = validations.update_leave(data);
    if (error) return res.status(400).send(error.details[0].message);
    const userRole = req.employee.role_name.toLowerCase();
    if (req.employee.admin_type=== '4' || req.employee.admin_type==='1') {
      return res.status(400).send('Access denied: Not Team Incharge or Manager');
    };
    const findId = await mongoFunctions.find_one('LEAVE', {
      leave_application_id: data.leave_application_id,
      // leave_status: data.leave_status
    });
    if (!findId) return res.status(400).send('No Leave Application Found');
    console.log(findId);
    const findEmployee= await mongoFunctions.find_one('EMPLOYEE', {
     employee_id: findId.employee_id,
     "leaves.leave_id": findId.leave_type_id
    });
    console.log(findEmployee);
    if (!findEmployee) return res.status(400).send('No Employee Found for the given application');
    const leaveRecord = findEmployee.leaves.find(leave => leave.leave_id === findId.leave_type_id);
    if (!leaveRecord) {
      return res.status(400).send('No leave record found for the given leave type');
  }

    if (leaveRecord&& leaveRecord.remaining_leaves <= 0) {
      return res.status(400).send('Limit Exceeded: Employee Has No Remaining Leaves');
    }
    
    let approved_by=findId.approved_by;
    if (req.employee.admin_type==="3"){
      approved_by.team_incharge={
        employee_id: req.employee.employee_id,
        email: req.employee.email,
        approvedAt: new Date(),
        leave_status: data.leave_status,
        }
    }
    if (req.employee.admin_type==="2"){
      approved_by.manager={
        employee_id: req.employee.employee_id,
       email:req.employee.email,
        approvedAt: new Date(),
        leave_status: data.leave_status,
        }
    }
   
    
    const leave_data_up = await mongoFunctions.find_one_and_update(
      'LEAVE',
      {
        leave_application_id: data.leave_application_id,
      },
      {
        $set: {
          "approved_by":approved_by
      }
      });
      let overallStatus="Pending"
      const statuses = [
        leave_data_up.approved_by.manager?.leave_status,
        leave_data_up.approved_by.team_incharge?.leave_status,
        leave_data_up.approved_by.hr?.leave_status
      ];
    
      // Determine the overall status based on the statuses array
      for (const status of statuses) {
        if (status === 'Rejected') {
          overallStatus = 'Rejected';
          break; 
        } else if (status === 'Pending') {
          overallStatus = 'Pending';
        } else if (status === 'Approved') {
          
            overallStatus = 'Approved'; 
        }
      };
      console.log(overallStatus);
    
      updated_leave_data = await mongoFunctions.find_one_and_update("LEAVE",{"organisation_id":req.employee.organisation_id,"leave_application_id":data.leave_application_id},{$set:{"leave_status":overallStatus}});
      if (updated_leave_data.leave_status === "Approved") {
        const h = await mongoFunctions.find_one_and_update(
          "EMPLOYEE",
          {
            organisation_id: req.employee.organisation_id,
            employee_id: findId.employee_id,
            "leaves.leave_id": findId.leave_type_id
          },
          {
            $inc: { "leaves.$.remaining_leaves": -findId.days_taken }  
          }
        );
        console.log(h);
      //   await mongoFunctions.find_one_and_update(
      //     "LEAVE",
      //     {
      //         organisation_id: req.employee.organisation_id,
      //         employee_id: findId.employee_id
      //     },
      //     {
      //         $set: { leaves: h.leaves } // Replace the entire leaves array with h.leaves
      //     }
      // );
      }
      
      if (updated_leave_data.leave_status === "Rejected") {
        const l = await mongoFunctions.find_one_and_update(
          "LEAVE",
          {
            organisation_id: req.employee.organisation_id,
            employee_id: findId.employee_id
          },
          {
            $set: { lop_leaves: findId.days_taken }  // Set the LOP leaves
          }
        );
        console.log(l);
      //   await mongoFunctions.find_one_and_update(
      //     "LEAVE",
      //     {
      //         organisation_id: req.employee.organisation_id,
      //         employee_id: findId.employee_id
      //     },
      //     {
      //         $set: { leaves: l.leaves } // Replace the entire leaves array with h.leaves
      //     }
      // );
      }
      
      
      

    
    return res.status(200).send("Leave Status Updated Successfully")

  }))
  router.post("/update_leave_status",Auth,rateLimit(60,10),Async(async(req, res) => {
    const data = req.body;
    const { error } = validations.update_leave(data);
    if (error) return res.status(400).send(error.details[0].message);
    const userRole = req.employee.role_name.toLowerCase();
    if (req.employee.admin_type=== '4' || req.employee.admin_type=== '3'  || req.employee.admin_type=== '2' ) {
      return res.status(400).send('Access denied: Not Admin');
    };
    const findId = await mongoFunctions.find_one('LEAVE', {
      leave_application_id: data.leave_application_id,
      // leave_status:reject
      // leave_status: data.leave_status
    });
    if (!findId) return res.status(400).send('No Leave Application Found');
    if (findId && findId.leave_status===data.leave_status) return res.status(400).send('Leave Application Is Already In The Given Status'); 
    console.log(findId);
    const findEmployee= await mongoFunctions.find_one('EMPLOYEE', {
     employee_id: findId.employee_id,
     "leaves.leave_id": findId.leave_type_id
    });
    // console.log(findEmployee);
    if (!findEmployee) return res.status(400).send('No Employee Found for the given application');
    const leaveRecord = findEmployee.leaves.find(leave => leave.leave_id === findId.leave_type_id);
    if (!leaveRecord) {
      return res.status(400).send('No leave record found for the given leave type');
  }

    if (leaveRecord&& leaveRecord.remaining_leaves <= 0) {
      return res.status(400).send('Limit Exceeded: Employee Has No Remaining Leaves');
    }
    
    const leave_data_up = await mongoFunctions.find_one_and_update(
      'LEAVE',
      {
        leave_application_id: data.leave_application_id,
      },
      {
        $set: {
          "leave_status":data.leave_status,
      }
      });
      
      if (findId.leave_status==="Pending" && leave_data_up.leave_status === "Approved") {
        const h = await mongoFunctions.find_one_and_update(
          "EMPLOYEE",
          {
            organisation_id: req.employee.organisation_id,
            employee_id: findId.employee_id,
            "leaves.leave_id": findId.leave_type_id
          },
          {
            $inc: { "leaves.$.remaining_leaves": -findId.days_taken }  
          }
        );
        console.log(h);
      }
      
      if (findId.leave_status==="Pending" && leave_data_up.leave_status === "Rejected") {
        const l = await mongoFunctions.find_one_and_update(
          "LEAVE",
          {
            organisation_id: req.employee.organisation_id,
            employee_id: findId.employee_id
          },
          {
            $inc: { lop_leaves: +findId.days_taken }  // Set the LOP leaves
          }
        );
        console.log(l);
      }
      if (findId.leave_status==="Approved" && leave_data_up.leave_status === "Rejected") {
        const l = await mongoFunctions.find_one_and_update(
          "LEAVE",
          {
            organisation_id: req.employee.organisation_id,
            employee_id: findId.employee_id
          },
          {
            $inc: { lop_leaves: +findId.days_taken }  // Set the LOP leaves
          }
        );
        console.log(l);
      const h = await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        {
          organisation_id: req.employee.organisation_id,
          employee_id: findId.employee_id,
          "leaves.leave_id": findId.leave_type_id
        },
        {
          $inc: { "leaves.$.remaining_leaves": +findId.days_taken }  
        }
      );
      console.log(h);
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

    }))


