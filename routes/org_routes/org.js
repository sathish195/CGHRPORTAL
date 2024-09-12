const express = require('express');
const mongoFunctions = require('../../helpers/mongoFunctions');
const router=express.Router();
const validations=require('../../helpers/schema');
const bcrypt=require('../../helpers/crypto');
const jwt=require('jsonwebtoken');
const { Auth } = require("../../middlewares/auth");
const redis=require('../../helpers/redisFunctions');
const functions=require('../../helpers/functions');
const stats=require('../../helpers/stats');
const { mongo } = require('mongoose');
const Fuse = require("fuse.js");
const Async = require("../../middlewares/async");
const rateLimit= require('../../helpers/custom_rateLimiter');
const slowDown=require("../../middlewares/slow_down");




router.post('/add_update_org_details',Auth,rateLimit(60,10),Async(async (req,res)=>{
    let data=req.body;
    const { error } = validations.add_update_org(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.admin_type !== "1") 
        return res.status(403).send("Only Director can access this endpoint");

    let find_org = await mongoFunctions.find_one("ORGANISATIONS", {
        email: req.employee.email,
      });
    let org_data_up;
    let org_data = {
    email: req.employee.email,
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
    } else {
    let new_org_data = {
        organisation_id: functions.get_random_string("O", 15, true),
        organisation_name: data.organisation_name.toUpperCase(),
        employee_id: req.employee.employee_id,
        email: req.employee.email,
        ...org_data,
        roles:[
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "admin",
                admin_type:"1"
            },
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "manager",
                admin_type:"2"
            },
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "team incharge",
                admin_type:"3"
            },
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "team member",
                admin_type:"4"
            },
        ]
    };
    org_data_up = await mongoFunctions.create_new_record(
        "ORGANISATIONS",
        new_org_data
    );
    let employee = await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        { employee_id: req.employee.employee_id },
        { organisation_id: org_data_up.organisation_id },
        { new: true }
    );
    }
    await redis.update_redis("ORGANISATIONS", org_data_up);
    return res
    .status(200)
    .send({ success: "Details Added..!", data: org_data_up });
}));

router.post('/add_update_department', Auth,rateLimit(60,10), Async(async (req, res) => {
    let data = req.body;

    // Validate data
    var { error } = validations.add_update_department(data);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.admin_type !== "1" && req.employee.admin_type !=="2")
        return res.status(403).send("Only Director Or Manager Can Access This Endpoint");
    let org=await mongoFunctions.find_one("ORGANISATIONS", {
        email: req.employee.email,
      });

    // Retrieve organisation data from Redis
    let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        org.organisation_id,
        true
    );
    console.log(org_data);
    // console.log(org_data.organisation_id);
    if (org_data && org_data.organisation_id === data.organisation_id) {
        // Check if department already exists
        let department_exists = org_data.departments.find(
            (e) => e.department_name.toLowerCase() === data.department_name.toLowerCase()
        );

        if (department_exists) {
            return res.status(400).send("Department Already Exists..!");
        }

        // Update or add department
        let department_data_up;

        if (data.department_id && data.department_id.length > 9) {
            department_data_up = await mongoFunctions.find_one_and_update(
                "ORGANISATIONS",
                {
                    organisation_id: org_data.organisation_id,
                    "departments.department_id": data.department_id,
                },
                {
                    $set: {
                        "departments.$[dep].department_name": data.department_name.toLowerCase(),
                    },
                },
                {
                    arrayFilters: [
                        { "dep.department_id": data.department_id },
                    ],
                    new: true,
                }
            );
            let employee_data_up = await mongoFunctions.update_many(
                "EMPLOYEE",
                {
                    organisation_id: org_data.organisation_id,
                    "work_info.department_id": data.department_id,
                },
                {
                    $set: {
                        "work_info.department_name": data.department_name.toLowerCase(),
                    },
                },
            );


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
                        "departments": new_department_data,
                    },
                },
                { new: true }
            );
        }

        if (department_data_up) {
            await redis.update_redis("ORGANISATIONS", department_data_up);
            return res.status(200).send({
                success: "Department Details Added..!",
                data: department_data_up,
            });
        }

        return res.status(400).send("Failed to add");
    }

    return res.status(400).send("Invalid Organisation id");
}));
router.post('/add_update_designation', Auth,rateLimit(60,10), Async(async (req, res) => {
    let data = req.body;

    // Validate data
    var { error } = validations.add_update_designation(data);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.admin_type !== "1" && req.employee.admin_type !=="2")
        return res.status(403).send("Only Director Or Manager Can Access This Endpoint");
    org=await mongoFunctions.find_one("ORGANISATIONS", {
        email: req.employee.email,
      });
    // Retrieve organisation data from Redis
    let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        org.organisation_id,
        true
    );

    if (org_data && org_data.organisation_id === data.organisation_id) {
        // Check if designation already exists
        let designation_exists = org_data.designations.find(
            (e) => e.designation_name.toLowerCase() === data.designation_name.toLowerCase()
        );

        if (designation_exists) {
            return res.status(400).send("Designation Already Exists..!");
        }

        let designation_up;

        // Update or add designation
        if (data.designation_id && data.designation_id.length > 9) {
            designation_up = await mongoFunctions.find_one_and_update(
                "ORGANISATIONS",
                {
                    organisation_id: org_data.organisation_id,
                    "designations.designation_id": data.designation_id,
                    // "designations.leaves.leave_id": data.leave_id
                },
                {
                    $set: {
                        "designations.$[des].designation_name": data.designation_name.toLowerCase(),
                        // ""
                    },
                },
                {
                    arrayFilters: [
                        { "des.designation_id": data.designation_id,
                            // "des.leave.leave_id": data.leave_id
                         },
                    ],
                    new: true,
                }
            );
            employee_data_up = await mongoFunctions.update_many(
                "EMPLOYEE",
                {
                    organisation_id: org_data.organisation_id,
                    "work_info.designation_id": data.designation_id,
                },
                {
                    $set: {
                        "work_info.designation_name": data.designation_name.toLowerCase(),
                    },
                },
            );

        } else {
            // const processedLeaves = data.leaves.map(leave => ({
            //     ...leave,
            //     leave_id: functions.get_random_string("L",8,true) // Generate a unique ID for each leave
            // }));
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
                        "designations": new_designation_data,
                    },
                },
                { new: true }
            );
        }

        // Update Redis cache
        await redis.update_redis("ORGANISATIONS", designation_up);

        return res.status(200).send({
            success: "Designation Details Added..!",
            data: designation_up,
        });
    }

    return res.status(400).send("Invalid Organisation id");
}));

router.post("/add_update_role", Auth,rateLimit(60,10),Async( async (req, res) => {
    let data = req.body;

    // Validate data
    const { error } = validations.add_update_role(data);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.admin_type !== "1") 
        return res.status(403).send("Only Director can access this endpoint");


    org=await mongoFunctions.find_one("ORGANISATIONS", {
        email: req.employee.email,
      });
    // if (!org){
    //     return res.status(400).send("Admin Email Not Found In The Given Organisation");
    // }

    // Fetch organization data from Redis
    let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        org.organisation_id,
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
                },
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
}));

router.post("/universal" ,Auth,slowDown,Async(async(req, res) => {
    let org=await mongoFunctions.find_one("ORGANISATIONS", {
        organisation_id: req.employee.organisation_id,
      });
    console.log(org);
    if (!org){
        let dashborad = {
            recent_hires: [],
            birthdays: [],
            organisation_details: [],
          };
        // await redis.update_redis("ORGANISATIONS",org_data);
        return res.status(200).send(dashborad);
    }

    let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        org.organisation_id,
        true
    );
    let recent_hires = await stats.recent_hires(req.employee.organisation_id);
    const birthdays=await stats.employees_with_birthday_today(req.employee.organisation_id);
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
            organisation_id: org_data.organisation_id,
            "work_info.admin_type": { $in: ["1", "2"] }
        },
        { _id: -1 } , 
        projection 
    );
    console.log(birthdays);
    const project = {
        employee_id: 1,
        _id:0,
        // "basic_info.first_name": 1,
        // "basic_info.last_name": 1,
        // "basic_info.email": 1,
        // "work_info.role_name": 1,
    };

    employee_id=await mongoFunctions.find_one(
        "EMPLOYEE",
        {
            organisation_id: org_data.organisation_id,
            // "work_info.admin_type": { $in: ["1", "2"] }
        }, // 
        project ,
        { createdAt: -1 } ,
    );
    // employee_id=await redis.redisGet(
    //     "EMPLOYEE",
    //     {
    //         organisation_id: org_data.organisation_id,
    //         // "work_info.admin_type": { $in: ["1", "2"] }
    //     }, // 
    //     project ,
    //     { createdAt: -1 } ,
    // );

       
        let dashborad = {
            recent_hires: recent_hires,
            birthdays: birthdays,
            organisation_details: org_data,
            reporting_managers: reporting_manager,
            employee_id:employee_id,
          };
        // await redis.update_redis("ORGANISATIONS",org);
        return res.status(200).send(dashborad);
        }));
     
    // return res
    //     .status(200)
    //     .send({ organisation_details: org_data });
    // });
    // await redis.update_redis("ORGANISATIONS",org);

//update leaves in a designation
router.post("/add_update_leave", Auth,rateLimit(60,10),Async( async (req, res) => {
    const data = req.body;

    // Validate data
    const { error } = validations.update_leaves(data);
    if (error) return res.status(400).send(error.details[0].message);

    if (req.employee.admin_type !== "1" && req.employee.admin_type !=="2")
        return res.status(403).send("Only Director Or Manager Can Access This Endpoint");

    // Retrieve organisation data from Redis
    const org_data = await redis.redisGet("CRM_ORGANISATIONS", req.employee.organisation_id, true);
    if (!org_data) {
        return res.status(400).send("Invalid Organisation id");
    }

    console.log("Retrieved org_data:", org_data);

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

    console.log("Found leave:", leave);

    if (data.leave_id && data.leave_id.length>1) {
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
            return res.status(400).send("Leave Name already exists for another leave ID.");
        }

        // Update leave
        const updatedLeave = await mongoFunctions.find_one_and_update(
            "ORGANISATIONS",
            {
                organisation_id: org_data.organisation_id,
                "roles.role_id": data.role_id,
                "roles.leaves.leave_id": data.leave_id
            },
            {
                $set: {
                    "roles.$[role].leaves.$[leave].leave_name": data.leave_name,
                    "roles.$[role].leaves.$[leave].total_leaves": data.total_leaves
                }
            },
            {
                arrayFilters: [
                    { "role.role_id": data.role_id },
                    { "leave.leave_id": data.leave_id }
                ],
                new: true
            }
        );

        console.log("Updated leave:", updatedLeave);

        if (!updatedLeave) {
            return res.status(404).send("Failed to update leave.");
        }

        await redis.update_redis("ORGANISATIONS", updatedLeave);
        // const leave_new = await mongoFunctions.find_one(
        //     "EMPLOYEE",
        //     {
        //         organisation_id: org_data.organisation_id,
        //         "work_info.designation_id": data.designation_id,
        //         "leaves.leave_id": data.leave_id
        //     },
        //     {
        //         "leaves.$": 1
        //     }
        // );
        // if (leave_new){
        //     const currentRemainingLeaves = leave_new.leaves[0].remaining_leaves;
        //     const totalLeaves = data.total_leaves;
            
            // Calculate the new value
            // const newRemainingLeaves = totalLeaves-currentRemainingLeaves ;
            // console.log(newRemainingLeaves);
        const remainingLeaves=data.total_leaves-leave.total_leaves;
        let remaining=Math.max(remainingLeaves, 0);
        // if (remainingLeaves>0){
        //     remaining = remainingLeaves;
        // }
        // else{
        //     remaining=0;
        // }
           
            await mongoFunctions.update_many(
                "EMPLOYEE",
                {
                  organisation_id: org_data.organisation_id,
                  "work_info.role_id": data.role_id,
                  "leaves.leave_id": data.leave_id
                },
                {
                  $set: {
                    "leaves.$[elem].leave_name": data.leave_name,
                    "leaves.$[elem].total_leaves": data.total_leaves,
                  },
                  $inc: {
                    "leaves.$[elem].remaining_leaves": remaining // Increment the remaining_leaves
                  }
                },
                {
                  arrayFilters: [
                    { "elem.leave_id": data.leave_id }
                  ]
                }
              );
              
            //   if (h) {
            //     console.log(h);
            //   }
       
        // }
        
       
        return res.status(200).send({
            success: "Leave Updated Successfully.",
            data: updatedLeave
        });

    } else {
        // Check if leave with the same name already exists
        const leaveExists =role.leaves.find(
            (e) => e.leave_name.toLowerCase() === data.leave_name.toLowerCase()
        );

        if (leaveExists) {
            return res.status(400).send("Leave Name already exists.");
        }

        // Add new leave
        const newLeave = {
            leave_id: functions.get_random_string("L", 9, true),
            leave_name: data.leave_name,
            total_leaves: data.total_leaves
        };

        const updatedOrg = await mongoFunctions.find_one_and_update(
            "ORGANISATIONS",
            {
                organisation_id: org_data.organisation_id,
                "roles.role_id": data.role_id
            },
            {
                $push: {
                    "roles.$.leaves": newLeave
                }
            },
            { new: true }
        );

        console.log("Updated organisation:", updatedOrg);

        if (!updatedOrg) {
            return res.status(404).send("Failed to add new leave.");
        }
        await mongoFunctions.update_many(
            "EMPLOYEE",
            {
                organisation_id: org_data.organisation_id,
                "work_info.role_id": data.role_id
            },
            {
                $push: {
                    "leaves": {
                        $each: [{
                            ...newLeave,
                            remaining_leaves: newLeave.total_leaves
                        }]
                    }
                }
            }
        );

        await redis.update_redis("ORGANISATIONS", updatedOrg);
        return res.status(200).send({
            success: "Leave added successfully.",
            data: updatedOrg
        });
    }
}));

router.post("/get_team_for_task", Auth, slowDown,Async(async (req, res) => {
    const data = req.body;
    const roleName = req.employee.admin_type;

    
    const query = {
        organisation_id: req.employee.organisation_id,
        employee_id: { $ne: req.employee.employee_id }
    };
    if (roleName === '2') { 
        query["work_info.admin_type"] = { $in: ["3", "4"] };  
    }else if (roleName==='1'){
    }else if (roleName === '3') {
        query["work_info.department_id"]=req.employee.department_id;
    } else {
        return res.status(403).send("Access denied: Invalid role");
    }

    const projection = {
        employee_id: 1,
        "basic_info.first_name": 1,
        "basic_info.last_name": 1,
        "basic_info.email": 1,
        "work_info.role_name": 1,
        "images":1
    };
    let teamMembers;

    if (data.name && data.name.length > 1) {
        const teamMembersFromDb = await mongoFunctions.find("EMPLOYEE", query, { _id: -1 }, projection);
        
        const fuse = new Fuse(teamMembersFromDb, {
            keys: ["basic_info.first_name", "basic_info.last_name"],
            threshold: 0.3,
        });

        teamMembers = fuse.search(data.name).map(result => result.item);
        console.log(teamMembers);
    } else {
        teamMembers = await mongoFunctions.find("EMPLOYEE", query, { _id: -1 }, projection);
    }

    // const teamMembers = await mongoFunctions.find("EMPLOYEE", query,{ _id: -1 }, projection);
    // console.log(teamMembers);

    if (!teamMembers || teamMembers.length === 0) {
        return res.status(404).send("No team members found.");
    }

    res.status(200).send(teamMembers);
}));


router.post("/get_team_for_project", Auth,slowDown, Async(async (req, res) => {
    try {
        const roleName = req.employee.admin_type;
        const query = {
            organisation_id: req.employee.organisation_id,
            employee_id: { $ne: req.employee.employee_id }
        };

        if (roleName === '1') {
            query["work_info.admin_type"] = "3"; 
        } else if (roleName === '2') {
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

        const teamMembers = await mongoFunctions.find("EMPLOYEE", query,{ _id: -1 }, projection);
        console.log(teamMembers);

        if (!teamMembers || teamMembers.length === 0) {
            return res.status(404).send("No team members found.");
        }

        res.status(200).json(teamMembers);
    } catch (error) {
        console.error("Error fetching team members:", error);
        res.status(500).send("Internal Server Error");
    }
}));

router.post("/update_token",Auth,Async(async(req, res)=>{

    const org_id=await mongoFunctions.find_one('ORGANISATIONS',{email:req.employee.email});
    if(!org_id) return res.status(404).send("Organisation not found");


    const token=jwt.sign({
        organisation_id: org_id.organisation_id,
        employee_id: req.employee.employee_id,
        first_name: req.employee.first_name,
        last_name: req.employee.last_name,
        email: req.employee.email,
        department_id: req.employee.department_id,
        designation_id: req.employee.designation_id,
        designation_name:req.employee.designation_name,
        role_id: req.employee.role_id,
        role_name: req.employee.role_name,
        admin_type:req.employee.admin_type,
        two_fa_status: req.employee.two_fa_status,
        status: req.employee.employee_status,
        collection: "EMPLOYEE",
      },process.env.jwtPrivateKey,{ expiresIn: "90d" });
    console.log(token);
  
    return res.status(200).send({
    success: token,
    });


}))


router.post(
    "/add_admin_employee",
    Async((async (req, res) => {
      
      const new_password="Emp@1234";
      let password_hash = await bcrypt.hash_password(new_password);

      let new_emp_data = 
        {
            "organisation_id": "O9593C6393261F1",
            "employee_id": "CGTPL0001",
            "password":"Emp@1234",
            "email": "admin@gmail.com",
            "first_name": "pavan",
            "last_name": "Rebba",
            "nick_name": "pavan sir",
            "department_id": "D72FAFACC9E",
            "role_id": "RD53A5ACBC27D09",
            "designation_id": "DE2CDAC3B2C",
            "employment_type": "Full-time",
            "employee_status": "active",
            "source_of_hire": "nothing",
            "reporting_manager": "teju@gmail.com",
            "date_of_join": "2024-09-12",
            "date_of_birth": "2024-09-12",
            "expertise": "Good in everything",
            "gender": "male",
            "marital_status": "married",
            "about_me": "A lot to say",
            "identity_info": {
              "pan":"188888888234",
              "uan":"123888888881"
          
            },
            "mobile_number": "9849841358",
            "personal_email_address": "pavan@gmail.com",
            "seating_location": "s-97",
            "present_address": "vijayawada,Ap",
            "permanent_address": "Hyderabad,Ts",
            "work_experience": [
              {
                "company_name": "codegene",
                "job_title": "Backend developer",
                "from_date": "2023-03-30",
                "to_date": "2024-08-30",
                "job_description": "Backend developement",
                "experience": 1
              }
            ],
            "educational_details": [
              
            ],
            "dependent_details": [
              
            ],
          
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
  ));


module.exports = router;
