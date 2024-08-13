const express = require('express');
const mongoFunctions = require('../../helpers/mongoFunctions');
const router=express.Router();
const validations=require('../../helpers/schema');
const bcrypt=require('../../helpers/crypto');
const jwt=require('jsonwebtoken');
const { Auth } = require("../../middlewares/auth");
const redis=require('../../helpers/redisFunctions');

//get employee list

//------------------------get emp by id------------------
router.post(
    "/get_emp_by_id",
    Auth,(async (req, res) => {
      let data = req.body;
      var { error } = validations.employee_id(data);
      if (error) return res.status(400).send(error.details[0].message);
      const emp = req.employee;
      if (emp.role_name.tolowercase()=== "director") {
        let emp = await mongoFunctions.find_one(
          "EMPLOYEE",
          {
            organisation_id: emp.organisation_id,
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
      const emp = req.user;
      const LIMIT = 50;
      let data = req.body;
      var { error } = validations.skip(data);
      if (error) return res.status(400).send(error.details[0].message);
      if (emp.role_name.tolowercase() !== "director") return res.status(400).send("Not Admin");
      let employees = await mongoFunctions.lazy_loading(
        "EMPLOYEE",
        { organisation_id: emp.organisation_id },
        { two_fa_key: 0, fcm_token: 0, browserid: 0, others: 0 },
        { _id: 1 },
        LIMIT,
        data.skip
      );
      return res.status(200).send({ employees });
    })
  )
  module.exports =router;