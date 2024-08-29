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
// const bcrypt=require('bcrypt');

router.post('/login',async(req,res)=>{
    data=req.body;
    console.log(data);
    //validate data
    var {error}=validations.emp_login(data);
    if(error) return res.status(400).send(error.details[0].message);
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email.toLowerCase()});
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
    await redis.genOtp( employee.employee_id, otp, 120);
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
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email.toLowerCase()});
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
    await redis.genOtp(employee.employee_id, otp, 120);

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
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email.toLowerCase()});
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
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email.toLowerCase()});
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
    await redis.genOtp(employee.employee_id, otp, 120);
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
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email.toLowerCase()});
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
        first_name: up_emp.basic_info.first_name,
        last_name: up_emp.basic_info.last_name,
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

  router.post("/edit_profile",Auth, async (req, res) =>{
    let data = req.body;
    console.log(req.body);
      var { error } = validations.edit_profile(data);
      if (error) return res.status(400).send(error.details[0].message);
      let org_data = await redis.redisGet(
        "CRM_ORGANISATIONS",
        req.employee.organisation_id,
        true
      );
      if (!org_data) return res.status(400).send("Access Denied..!");
      let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
    
        employee_id: data.employee_id.toUpperCase(),
        organisation_id: org_data.organisation_id,
        });
      if (!find_emp){
            return res.status(400).send("Employee Id Doesn't exists");
       }
       if (!Array.isArray(data.educational_details) || data.educational_details.length === 0) {
        return res.status(400).send("Educational details array must contain at least one entry.");
    }
    let existingEmployee = await mongoFunctions.find_one("EMPLOYEE", {
        $and: [
            { "contact_details.personal_email_address": data.personal_email_address },
            // {
            //   // "organisation_id": data.organisation_id
            // },
            { employee_id: { $ne: data.employee_id } }
        ]
    });
    if (existingEmployee) {
        if (existingEmployee.contact_details.personal_email_address === data.personal_email_address) {
            return res.status(400).send("Personal email address already exists for another employee.");
        }
    }
      let edit_emp_data = {
        "basic_info.nick_name": data.nick_name,
        "personal_details.expertise": data.expertise,
        "personal_details.marital_status": data.marital_status,
        "personal_details.about_me": data.about_me,

        identity_info: data.identity_info,
        "contact_details.work_phone_number": data.work_phone_number,
        "contact_details.personal_email_address": data.personal_email_address,
        "contact_details.personal_mobile_number": data.personal_mobile_number,

        work_experience: data.work_experience,
        educational_details: data.educational_details,
        dependent_details: data.dependent_details,
        last_ip: data.last_ip,
        browserid: data.browserid,
        fcm_token: data.fcm_token,
        device_id: data.device_id,
      };
      let update_emp = await mongoFunctions.find_one_and_update(
        "EMPLOYEE",
        { employee_id: req.employee.employee_id },
        edit_emp_data,
        { new: true }
      );
      return res.status(200).send({
        success: "Success",
        data: update_emp,
      });
    });
    router.post("/update_task",Auth,async(req, res)=>{
      const data = req.body;
      const { error } = validations.update_task(data);
      if(error) return res.status(400).send(error.details[0].message);
      const userRole = req.employee.role_name.toLowerCase();
      if(userRole==='director'){
        return res.status(403).send('Access denied: Not Team Member');
      }
      const findId = await mongoFunctions.find_one('TASKS',{
        organisation_id: req.employee.organisation_id,
        task_id: data.task_id
      });
      if(!findId) return res.status(400).send('Task ID does not exist');
      const task_data_up = await mongoFunctions.find_one_and_update(
        'TASKS',
        {
          organisation_id: req.employee.organisation_id,
          task_id: data.task_id,
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
            if(!task_data_up) return res.status(400).send('Task Update Failed');
            if (findId.status !== data.status) {
              const s = await stats.update_stats(req.employee.employee_id, req.employee.organisation_id,findId.status, data.status);
              console.log("done adding");
            }
            console.log("Sending");
            return res.status(200).send('Task Updated Successfully');
    });

router.post("/apply_leave",Auth,async(req,res) => {
  if (req.employee.role_name ==="director"){
    return res.status(400).send('Access denied: Director Do Not Apply Leave');
  }
  let data = req.body;
  var { error } = validations.apply_leave(data);
  if (error) return res.status(400).send(error.details[0].message);
  let org_data = await redis.redisGet(
    "CRM_ORGANISATIONS",
    req.employee.organisation_id,
    true
  );
  if (!org_data) return res.status(400).send("Access Denied..!..No Organization Found For The Given Employee..!!");
  let find_emp = await mongoFunctions.find_one("EMPLOYEE", {
    employee_id: req.employee.employee_id,
  });
  if (!find_emp) return res.status(400).send("Employee Not Found..!");

  const emp_leave_obj = find_emp.leaves.find(
    (e) => e.leave_id === data.leave_type
  );
  if (!emp_leave_obj)
    return res.status(400).send("Leave Type Not Found..!");
  const over_lapping_leaves = await mongoFunctions.find("LEAVE", {
    organisation_id: find_emp.organisation_id,
    employee_id: find_emp.employee_id,
    from_date: { $lte: new Date(data.from_date) },
    to_date: { $gte: new Date(data.to_date )},
  });

  if (over_lapping_leaves.length > 0)
    return res
      .status(400)
      .send("Leave Already Applied On Selected Dates");
  let leaves_count = await functions.calculate_leave_days(
    data.from_date,
    data.to_date
  );
  if (leaves_count > emp_leave_obj.remaining_leaves)
    return res.status(400).send("Leaves Limit Exceeded..!");
  let leave_record_obj = {
    leave_application_id: functions.get_random_string("L", 15, true),
    organisation_id: find_emp.organisation_id,
    employee_id: find_emp.employee_id,
    leave_type_id: emp_leave_obj.leave_id,
    leave_type: emp_leave_obj.leave_name,
    employee_name:
      find_emp.basic_info.first_name + "" + find_emp.basic_info.last_name,
    email: find_emp.basic_info.email,
    days_taken: leaves_count,
    from_date: data.from_date,
    to_date: data.to_date,
    reason: data.reason,
    team_mail_id: data.team_mail_id,
    leave_status: "Pending",
  };
  await mongoFunctions.create_new_record("LEAVE", leave_record_obj);
  return res.status(200).send({
    success: "Leave Applied Successfully...!",
  });
});
  
  
  
  