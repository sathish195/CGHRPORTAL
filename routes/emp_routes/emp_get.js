const express = require('express');
const mongoFunctions = require('../../helpers/mongoFunctions');
const router=express.Router();
const validations=require('../../helpers/schema');
const bcrypt=require('../../helpers/crypto');
const jwt=require('jsonwebtoken');
const { Auth } = require("../../middlewares/auth");
const redis=require('../../helpers/redisFunctions');


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