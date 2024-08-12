const express = require('express');
const mongoFunctions = require('../../helpers/mongoFunctions');
const router=express.Router();
const validations=require('../../helpers/schema');
const bcrypt=require('../../helpers/crypto');
const jwt=require('jsonwebtoken');
const { Auth } = require("../../middlewares/auth");
const redis=require('../../helpers/redisFunctions');
const functions=require('../../helpers/functions');


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
                role_name: "TEAM MEMBER",
            },
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "MANAGER",
            },
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "DIRECTOR",
            },
            {
                role_id: functions.get_random_string("R", 15, true),
                role_name: "TEAM INCHARGE",
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


    // Retrieve organisation data from Redis
    let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
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
    var { error } = validate.add_designation(data);
    if (error) return res.status(400).send(error.details[0].message);
    if (req.employee.role_name.toLowerCase() !== "director") 
        return res.status(403).send("Only Director can access this endpoint");


    // Retrieve organisation data from Redis
    let org_data = await rediscon.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
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
            designation_up = await mongofunctions.find_one_and_update(
                "ORGANISATIONS",
                {
                    organisation_id: org_data.organisation_id,
                    "designations.designation_id": data.designation_id,
                },
                {
                    $set: {
                        "designations.$[des].designation_name": data.designation_name.toLowerCase(),
                    },
                },
                {
                    arrayFilters: [
                        { "des.designation_id": data.designation_id },
                    ],
                    new: true,
                }
            );
        } else {
            let new_designation_data = {
                designation_id: functions.get_random_string("D", 10, true),
                designation_name: data.designation_name.toLowerCase(),
            };

            designation_up = await mongofunctions.find_one_and_update(
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
        await rediscon.update_redis("ORGANISATIONS", designation_up);

        return res.status(200).send({
            success: "Designation Details Added..!",
            data: designation_up,
        });
    }

    return res.status(400).send("Invalid Organisation id");
});

  router.post("/add_update_role", Auth, async (req, res) => {
    let data = req.body;
    var { error } = validate.add_role(data);
    if (error) return res.status(400).send(error.details[0].message);
    let org_data = await rediscon.redisGet(
    "CRM_ORGANISATIONS",
    req.user.organisation_id,
    true
    );
    if (org_data && org_data.organisation_id === data.organisation_id) {
    let location_exists = org_data.locations.find(
        (e) => e.location_id.toLowerCase() === data.location_id.toLowerCase()
    );
    let role_data_up;
    if (location_exists) {
        let find_role = location_exists.roles.find(
        (e) => e.role_name.toLowerCase() === data.role_name.toLowerCase()
        );
        if (find_role) return res.status(400).send("Role Already Exists..!");
        if (data.role_id && data.role_id.length > 9) {
        role_data_up = await mongofunctions.find_one_and_update(
            "ORGANISATIONS",
            {
            organisation_id: org_data.organisation_id,
            "locations.location_id": data.location_id,
            "locations.roles.role_id": data.role_id,
            },
            {
            $set: {
                "locations.$[loc].roles.$[r].role_name":
                data.role_name.toLowerCase(),
            },
            },
            {
            arrayFilters: [
                { "loc.location_id": location_exists.location_id },
                { "r.role_id": data.role_id },
            ],
            new: true,
            }
        );
        } else {
        let new_role_data = {
            role_id: functions.get_random_string("R", 10, true),
            role_name: data.role_name.toLowerCase(),
        };
        role_data_up = await mongofunctions.find_one_and_update(
            "ORGANISATIONS",
            {
            organisation_id: org_data.organisation_id,
            "locations.location_id": data.location_id,
            },
            {
            $push: {
                "locations.$.roles": new_role_data,
            },
            },
            { new: true }
        );
        }
        await rediscon.update_redis("ORGANISATIONS", role_data_up);
        return res.status(200).send({
        success: "Role Details Added..!",
        data: role_data_up,
        });
    }
    return res.status(400).send("Location Not Found..!");
    }
    return res.status(400).send("Invalid Organisation id");
})

module.exports = router;