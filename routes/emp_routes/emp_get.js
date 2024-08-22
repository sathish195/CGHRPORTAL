const express = require('express');
const mongoFunctions = require('../../helpers/mongoFunctions');
const router=express.Router();
const validations=require('../../helpers/schema');
const bcrypt=require('../../helpers/crypto');
const jwt=require('jsonwebtoken');
const { Auth } = require("../../middlewares/auth");
const redis=require('../../helpers/redisFunctions');
const stats=require('../../helpers/stats');
// const rateLimiter=require('../../middlewares/rate_limiter');



//get employee profile

router.post(
    "/get_profile",
    Auth,(async (req, res) => {
      const employee= req.employee;
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
        }
      );
      if (!emp) return res.status(400).send("Employee Not Found..!");
      return res.status(200).send({ profile: emp });
    })
  )


  //get universal route

  router.post("/universal" ,Auth,async(req, res) => {
    // org=await mongoFunctions.find_one("ORGANISATIONS", {
    //     email: req.employee.email,
    //   });
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
    let recent_hires = stats.recent_hires(req.employee.organisation_id);
        let birthdays = await redis.redisGet(
          req.employee.organisation_id,
          "BIRTHDAYS",
          true
        );
        let today = new Date();
        let month = today.getMonth();
        let date = today.getDate();
        if (birthdays && birthdays[month]) {
          birthdays[month].filter((each) => {
            const dob = moment(each.date_of_birth, "DDMMYYYY");
            return date == dob.date();
          });
        }
        let dashborad = {
            recent_hires:  [],
            birthdays: birthdays && birthdays[month] ? birthdays[month] : [],
            organisation_details:filtered_org_data,
          };
        return res.status(200).send(dashborad);

        });

router.post("/get_tasks",Auth, async (req, res)=>{
  // data=req.body;
  // var { error } =validations.get_project_by_id(data);
  //   if (error) return res.status(400).send(error.details[0].message);

  const userRole = req.employee.role_name.toLowerCase();
  if (userRole === 'team incharge' ) {
  // return res.status(403).send('Access denied: Not Admin');
  // }
  findTask=await mongoFunctions.find("TASKS",{organisation_id:req.employee.organisation_id,"created_by.employee_id":req.employee.employee_id});
  return res.status(200).send(findTask)
  }else{
    const now = new Date();
    const start_day = new Date(now.setHours(0, 0, 0, 0));
    const end_day = new Date(now.setHours(23, 59, 59, 999));
    findT=await mongoFunctions.find("TASKS",{organisation_id:req.employee.organisation_id,status: { $nin: [/^completed$/i, /^under_review$/i] },team: { $elemMatch: { employee_id:req.employee.employee_id }}
    ,assign_track: { 
      $elemMatch: { 
        "assigned_to.employee_id": req.employee.employee_id,
        "assigned_to.date_time": { 
          $gte: start_day, // Greater than or equal to the start of today
          $lt: end_day // Less than the end of today
        }
      }
    }
  });
    return res.status(200).send(findT)
  }


  }); 
router.post("/get_task_by_id",Auth, async (req, res)=>{
  data=req.body;
  var { error } =validations.get_task_by_id(data);
    if (error) return res.status(400).send(error.details[0].message);
  
  findTask=await mongoFunctions.find_one("TASKS",{organisation_id:req.employee.organisation_id,task_id:data.task_id});
  if(!findTask) return res.status(400).send("Task not found")
  return res.status(200).send(findTask)

});

//get all tasks with filters

router.post("/get_all_tasks", Auth, async (req, res) => {
  const data = req.body;
  const { error } = validations.get_all_tasks(data);
  if (error) return res.status(400).send(error.details[0].message);

  const limit = 40;
  const skip=data.skip // Fixed limit value
  const userRole = req.employee.role_name.toLowerCase();

  let query = {
    organisation_id: req.employee.organisation_id
  };

  if (userRole === 'team incharge') {
    query["created_by.employee_id"] = req.employee.employee_id;

    if (data.status) {
      query.status = data.status;
    }

    if (data.date) {
      const date = new Date(data.date);
      const start_day = new Date(date.setHours(0, 0, 0, 0));
      const end_day = new Date(date.setHours(23, 59, 59, 999));
      query.createdAt = {
        $gte: start_day, // Greater than or equal to start of the day
        $lt: end_day    // Less than end of the day
      };
    }

  } else {
    query.status = { $nin: [/^completed$/i, /^under_review$/i] };
    query.team = { $elemMatch: { employee_id: req.employee.employee_id } };

    if (data.status) {
      query.status = data.status;
    }

    if (data.date) {
      const date = new Date(data.date);
      const start_day = new Date(date.setHours(0, 0, 0, 0));
      const end_day = new Date(date.setHours(23, 59, 59, 999));
      query.createdAt = {
        $gte: start_day, // Greater than or equal to start of the day
        $lt: end_day    // Less than end of the day
      };
    }
  }

  // Find tasks using the query object
  const findTask = await mongoFunctions.lazy_loading(
    "TASKS",
    query,
    { _id: 0, __v: 0 },       // Projection: exclude _id and __v fields
    { createdAt: -1 },         // Sort by creation date in descending order
    limit ,
    skip                   // Limit for pagination
  );

  return res.status(200).send(findTask);
});
module.exports =router;