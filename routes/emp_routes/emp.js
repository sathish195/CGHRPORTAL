

const express = require('express');
const mongoFunctions = require('../../helpers/mongoFunctions');
const router=express.Router();
const validations=require('../../helpers/schema');
const bcrypt=require('../../helpers/crypto');
const jwt=require('jsonwebtoken');
const { Auth } = require("../../middlewares/auth");
const redis=require('../../helpers/redisFunctions');
// const bcrypt=require('bcrypt');

router.post('/login',async(req,res)=>{
    data=req.body;
    console.log(data);
    //validate data
    var {error}=validations.emp_login(data);
    if(error) return res.status(400).send(error.details[0].message);
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email});
    if(!employee) return res.status(400).send('No Employee Found With The Given Email');
    const validPassword=await bcrypt.compare_password(data.password,employee.password);
    console.log(validPassword);
    console.log(employee.password);
    if(!validPassword) return res.status(400).send('Incorrect Password');
    if (
        // employee &&
        employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
        )
        return res
            .status(400)
            .send("Employee Status Disabled! Please Contact Admin.");
    await mongoFunctions.find_one_and_update(
    "EMPLOYEE",
    { employee_id: employee.employee_id },
    {
        last_ip: data.last_ip,
        fcm_token: data.fcm_token,
        device_id: data.device_id,
        browserid: data.browserid,
    }
    );
    // otp=OTP(true)
    var OTP="654321";
    var otp=OTP;
    await redis.genOtp( employee.employee_id, otp, 180);
    //send otp
    return res.status(200).send({
    success: "OTP Sent Successfully",
    two_fa_status: employee.two_fa_status,
    });  

});
module.exports = router;

router.post('/forgot_password',async(req,res) => {
    data=req.body;
    //validate data
    var {error}=validations.emp_forgot_password(data);
    if(error) return res.status(400).send(error.details[0].message);
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email});
    if(!employee) return res.status(400).send('No Employee Found With The Given Email');
    if (
        // employee &&
        employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
        )
        return res
            .status(400)
            .send("Employee Status Disabled! Please Contact Admin.");
    var OTP="654321";
    var otp=OTP;
    await redis.genOtp(employee.employee_id, otp, 180);

    //send otp
    return res.status(200).send({
    success: "OTP Sent Successfully",
    });  
});
router.post('/reset_forgot_password',async(req,res) => {
    data=req.body;
    //validate data
    var {error}=validations.emp_reset_forgot_password(data);
    if(error) return res.status(400).send(error.details[0].message);
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email});
    if(!employee) return res.status(400).send('No Employee Found With The Given Email');
    if (
        // employee &&
        employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
        )
        return res
            .status(400)
            .send("Employee Status Disabled! Please Contact Admin.");
    let otp = await redis.redisGetSingle(  employee.employee_id);
    if (!otp) return res.status(400).send("Otp Is Expired");
    if (Number(data.otp) !== Number(otp)) {
        return res.status(400).send("Invalid OTP");
    }
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
});

//resend otp

router.post('/resend_otp',async(req,res) => {
    data=req.body;
    //validate data
    var {error}=validations.emp_forgot_password(data);
    if(error) return res.status(400).send(error.details[0].message);
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email});
    if(!employee) return res.status(400).send('No Employee Found With The Given Email');
    if (
        // employee &&
        employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
    )
        return res
           .status(400)
           .send("Employee Status Disabled! Please Contact Admin.");
    // otp='654321'
    var OTP="654321";
    var otp=OTP;
    await redis.genOtp(employee.employee_id, otp, 180);
    //send otp
    return res.status(200).send({
    success: "OTP Sent Successfully",
    });
})

//login_verify

router.post('/login_verify',async(req,res) => {
    data=req.body;
    //validate data
    var {error}=validations.emp_login_verify(data);
    if(error) return res.status(400).send(error.details[0].message);
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email});
    if(!employee) return res.status(400).send('No Employee Found With The Given Email');
    if (
        // employee &&
        employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
    )
        return res
           .status(400)
           .send("Employee Status Disabled! Please Contact Admin.");
    //handle otp expiration and invalid 
    let otp = await redis.redisGetSingle( employee.employee_id);
    if (!otp) return res.status(400).send("Otp Is Expired");
    if (Number(data.otp) !== Number(otp)) {
      return res.status(400).send("Invalid OTP");
    }
    const up_emp = await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        { employee_id: employee.employee_id },
        {
          last_ip: data.last_ip,
          device_id: data.device_id,
          browserid: data.browserid,
        },
        { new: true }
      );

    //token
    const token=jwt.sign({
        organisation_id: up_emp.organisation_id,
        employee_id: up_emp.employee_id,
        email: up_emp.basic_info.email,
        department_id: up_emp.work_info.department_id,
        designation_id: up_emp.work_info.designation_id,
        role_id: up_emp.work_info.role_id,
        role_name: up_emp.work_info.role_name,
        two_fa_status: up_emp.two_fa_status,
        status: employee.work_info.employee_status,
        collection: "EMPLOYEE",
      },process.env.jwtPrivateKey,{ expiresIn: "90d" });
    console.log(token);

    return res.status(200).send({
    success: token,
    });
    
    })
//change password

router.post('/reset_password',Auth, async (req, res) =>{
    data=req.body;
    //validate data
    var {error}=validations.emp_reset_password(data);
    if(error) return res.status(400).send(error.details[0].message);
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':req.employee.email});
    if(!employee) return res.status(400).send('No Employee Found With The Given Email');
    if (
        // employee &&
        employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
    )
        return res
           .status(400)
           .send("Employee Status Disabled! Please Contact Admin.");
    const verifyOldPassword=await bcrypt.compare_password(data.old_password,employee.password);
    if (!verifyOldPassword) return res.status(400).send("Incorrect Old Password");
    const verifyPassword=await bcrypt.compare_password(data.new_password,employee.password);
    console.log(verifyPassword);
    console.log(employee.password);
    if(verifyPassword) return res.status(400).send("Password Should Not Same As Old Password");
    
    const hashedPassword=await bcrypt.hash_password(data.new_password);
    await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        { employee_id: employee.employee_id },
        { password: hashedPassword }
    );
    return res.status(200).send({
    success: "Password Changed Successfully",
    });

})

//update dp

router.post(
    "/update_dp",
    Auth,(async (req, res) => {
      if (req.employee.collection !== "EMPLOYEE")
        return res.status(400).send("Invalid token details");
      let data = req.body;
      var { error } = validations.add_image(data);
      if (error) return res.status(400).send(error.details[0].message);
      let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
        true
      );
      if (!org_data) return res.status(400).send("Access Denied..!");
      let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
        employee_id: req.employee.employee_id,
      });
      if (!find_emp) return res.status(400).send("Employee Not Found..!");
      if (!find_emp.work_info)
        return res.status(400).send("Profile data must be filled..!");
      if (
        find_emp &&
        find_emp.work_info &&
        find_emp.work_info.employee_status.toLowerCase() !== "active"
      )
        return res.status(400).send("Account not in Active, Contact Admin");

      if (!find_emp.images) {
        update = { images: { dp: data.image } };
      } else {
        update = { "images.dp": data.image };
      }
      let update_emp = await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        { employee_id: req.employee.employee_id },
        update,
        { new: true }
      );
      //   await rediscon.update_redis("EMPLOYEE", new_emp);
    //   await stats.update_emp(update_emp, true, false);
      return res.status(200).send({
        success: "Success",
        data: update_emp.images.dp,
      });
    })
  )