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



router.post('/add_update_org_details',Auth,async (req,res)=>{
    let data=req.body;
    const { error } = validations.add_update_org(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.role_name.toLowerCase() !== "director") 
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
                role_name: "Team Member",
            },
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "Manager",
            },
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "Director",
            },
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "Team Incharge",
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
});

router.post('/add_update_department', Auth, async (req, res) => {
    let data = req.body;

    // Validate data
    var { error } = validations.add_update_department(data);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.role_name.toLowerCase() !== "director") 
        return res.status(403).send("Only Director can access this endpoint");
    org=await mongoFunctions.find_one("ORGANISATIONS", {
        email: req.employee.email,
      });

    // Retrieve organisation data from Redis
    let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        org.organisation_id,
        true
    );
    console.log(org_data);
    console.log(org_data.organisation_id);
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
});
router.post('/add_update_designation', Auth, async (req, res) => {
    let data = req.body;

    // Validate data
    var { error } = validations.add_update_designation(data);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.role_name.toLowerCase() !== "director") 
        return res.status(403).send("Only Director can access this endpoint");

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
});

router.post("/add_update_role", Auth, async (req, res) => {
    let data = req.body;

    // Validate data
    const { error } = validations.add_update_role(data);
    if (error) return res.status(400).send(error.details[0].message);
    org=await mongoFunctions.find_one("ORGANISATIONS", {
        email: req.employee.email,
      });

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
});

router.post("/universal" ,Auth,async(req, res) => {
    // org=await mongoFunctions.find_one("ORGANISATIONS", {
    //     email: req.employee.email,
    //   });
    let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
        true
    );
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
            recent_hires: [],
            birthdays: birthdays && birthdays[month] ? birthdays[month] : [],
            organisation_details: org_data,
          };
        // await redis.update_redis("ORGANISATIONS",org_data);
        return res.status(200).send(dashborad);
        });
     
    // return res
    //     .status(200)
    //     .send({ organisation_details: org_data });
    // });
    // await redis.update_redis("ORGANISATIONS",org);

//update leaves in a designation
router.post("/add_update_leave", Auth, async (req, res) => {
    const data = req.body;

    // Validate data
    const { error } = validations.update_leaves(data);
    if (error) return res.status(400).send(error.details[0].message);

    if (req.employee.role_name.toLowerCase() !== "director") {
        return res.status(403).send("Only Director can access this endpoint");
    }

    // Retrieve organisation data from Redis
    const org_data = await redis.redisGet("CRM_ORGANISATIONS", req.employee.organisation_id, true);
    if (!org_data) {
        return res.status(400).send("Invalid Organisation id");
    }

    console.log("Retrieved org_data:", org_data);

    // Check if designation exists
    const designation = org_data.designations.find(
        (e) => e.designation_id.toLowerCase() === data.designation_id.toLowerCase()
    );

    if (!designation) {
        return res.status(400).send("Designation ID doesn't exist.");
    }

    console.log("Found designation:", designation);

    // Check if leave exists
    const leave = designation.leaves.find(
        (e) => e.leave_id.toLowerCase() === data.leave_id.toLowerCase()
    );

    console.log("Found leave:", leave);

    if (data.leave_id && data.leave_id.length>1) {
        // If leave_id is provided and valid, update the existing leave
        if (!leave) {
            return res.status(400).send("Leave ID doesn't exist.");
        }
        const leaveNameConflict = designation.leaves.some(
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
                "designations.designation_id": data.designation_id,
                "designations.leaves.leave_id": data.leave_id
            },
            {
                $set: {
                    "designations.$[des].leaves.$[leave].leave_name": data.leave_name,
                    "designations.$[des].leaves.$[leave].total_leaves": data.total_leaves
                }
            },
            {
                arrayFilters: [
                    { "des.designation_id": data.designation_id },
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
        return res.status(200).send({
            success: "Leave updated successfully.",
            data: updatedLeave
        });

    } else {
        // Check if leave with the same name already exists
        const leaveExists = designation.leaves.find(
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
                "designations.designation_id": data.designation_id
            },
            {
                $push: {
                    "designations.$.leaves": newLeave
                }
            },
            { new: true }
        );

        console.log("Updated organisation:", updatedOrg);

        if (!updatedOrg) {
            return res.status(404).send("Failed to add new leave.");
        }

        await redis.update_redis("ORGANISATIONS", updatedOrg);
        return res.status(200).send({
            success: "Leave added successfully.",
            data: updatedOrg
        });
    }
});

router.post("/get_employees_by_department", Auth, async (req, res) => {
    const data = req.body;

    // Validate data

    // if (req.employee.role_name.toLowerCase() === "team member") {
    //     return res.status(403).send("You Do Not Have Access To This Endpoint");
    // }
    // Find employees by department
    const find_employees = await mongoFunctions.aggregate(
        "EMPLOYEE",
        [
            // Stage 1: Match documents based on organisation_id and department_name
            {
                $match: {
                    organisation_id: req.employee.organisation_id,
                    employee_id: { $ne: req.employee.employee_id },
                    "work_info.department_id": req.employee.department_id,
                }
            },
            // Stage 2: Project only the required fields
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
});
module.exports = router;