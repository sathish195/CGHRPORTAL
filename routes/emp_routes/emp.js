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
const Async = require("../../middlewares/async");
const rateLimit= require('../../helpers/custom_rateLimiter');
const slowDown=require("../../middlewares/slow_down");
// const bcrypt=require('bcrypt');



router.post("/error",Async(async(req,res)=>{
  const error = req.validations.error;
  // alertDev("error")
  console.log(error);
  
  return res.send(error)

}))
router.post('/login',rateLimit(60,40),Async(async(req,res)=>{
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
    up_emp=await mongoFunctions.find_one_and_update(
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
    // var OTP="654321";
    // var otp=OTP;
    // await redis.genOtp( employee.employee_id, otp, 120);
    //send otp
     //token
     const token=jwt.sign({
      organisation_id: up_emp.organisation_id,
      employee_id: up_emp.employee_id,
      first_name: up_emp.basic_info.first_name,
      last_name: up_emp.basic_info.last_name,
      email: up_emp.basic_info.email,
      department_id: up_emp.work_info.department_id,
      designation_id: up_emp.work_info.designation_id,
      designation_name:up_emp.work_info.designation_name,
      role_id: up_emp.work_info.role_id,
      role_name: up_emp.work_info.role_name,
      admin_type:up_emp.work_info.admin_type,
      two_fa_status: up_emp.two_fa_status,
      status: employee.work_info.employee_status,
      collection: "EMPLOYEE",
    },process.env.jwtPrivateKey,{ expiresIn: "90d" });
  console.log(token);

  return res.status(200).send({
  success: "Logged In Successfully",
  token: token,
  });
  
  }))
module.exports = router;

router.post('/forgot_password',Async(async(req,res) => {
    data=req.body;
    //validate data
    var {error}=validations.emp_forgot_password(data);
    if(error) return res.status(400).send(error.details[0].message);
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email.toLowerCase()});
    if(!employee) return res.status(400).send('No Employee Found With The Given Email');
    if (employee.work_info.admin_type !== "1" && employee.work_info.admin_type !== "2"){
      return res.status(400).send("Access Denied..!!Contact Your Admin");
    }
    if (
        // employee &&
        employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
        )
        return res
            .status(400)
            .send("Employee Status Disabled! Please Contact Admin.");
    // var OTP="654321";
    // var otp=OTP;
    // await redis.genOtp(employee.employee_id, otp, 120);

    //send otp
    return res.status(200).send({
    success: "Success",
    });  
}));

//route for admin to reset their password

router.post('/reset_forgot_password',Async(async(req,res) => {
    data=req.body;
    //validate data
    var {error}=validations.emp_reset_forgot_password(data);
    if(error) return res.status(400).send(error.details[0].message);
    // const access=
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.employee_email.toLowerCase()});
    if(!employee) return res.status(400).send('No Employee Found With The Given Email');
    // if (employee.work_info.admin_type !== "1" && employee.work_info.admin_type !== "2"){
    //   return res.status(400).send("Only Director or Manager Can Access The Forgot Password Route!");
    // }
    if (
        // employee &&
        employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
        )
        return res
            .status(400)
            .send("Employee Status Disabled!");
    // let otp = await redis.redisGetSingle(employee.employee_id);
    // if (!otp) return res.status(400).send("Otp Is Expired");
    // if (Number(data.otp) !== Number(otp)) {
    //     return res.status(400).send("Invalid OTP");
    // }
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
}));

//resend otp

router.post('/resend_otp',Async(async(req,res) => {
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
}));

//login_verify

// router.post('/login_verify',async(req,res) => {
//     data=req.body;
//     //validate data
//     var {error}=validations.emp_login_verify(data);
//     if(error) return res.status(400).send(error.details[0].message);
//     const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':data.email.toLowerCase()});
//     if(!employee) return res.status(400).send('No Employee Found With The Given Email');
//     if (
//         // employee &&
//         employee.work_info.employee_status.toLowerCase() === "disable" || employee.work_info.employee_status.toLowerCase() ==="terminated"
//     )
//         return res
//            .status(400)
//            .send("Employee Status Disabled! Please Contact Admin.");
//     //handle otp expiration and invalid 
//     let otp = await redis.redisGetSingle( employee.employee_id);
//     if (!otp) return res.status(400).send("Otp Is Expired");
//     if (Number(data.otp) !== Number(otp)) {
//       return res.status(400).send("Invalid OTP");
//     }
//     const up_emp = await mongoFunctions.find_one_and_update(
//         "EMPLOYEE",
//         { employee_id: employee.employee_id },
//         {
//           last_ip: data.last_ip,
//           device_id: data.device_id,
//           browserid: data.browserid,
//         },
//         { new: true }
//       );

//     //token
//     const token=jwt.sign({
//         organisation_id: up_emp.organisation_id,
//         employee_id: up_emp.employee_id,
//         first_name: up_emp.basic_info.first_name,
//         last_name: up_emp.basic_info.last_name,
//         email: up_emp.basic_info.email,
//         department_id: up_emp.work_info.department_id,
//         designation_id: up_emp.work_info.designation_id,
//         designation_name:up_emp.work_info.designation_name,
//         role_id: up_emp.work_info.role_id,
//         role_name: up_emp.work_info.role_name,
//         two_fa_status: up_emp.two_fa_status,
//         status: employee.work_info.employee_status,
//         collection: "EMPLOYEE",
//       },process.env.jwtPrivateKey,{ expiresIn: "90d" });
//     console.log(token);

//     return res.status(200).send({
//     success: token,
//     });
    
//     })
//change password

router.post('/reset_password',Auth,rateLimit(60,10), Async(async (req, res) =>{
    data=req.body;
    //validate data
    var {error}=validations.emp_reset_password(data);
    if(error) return res.status(400).send(error.details[0].message);
    const employee=await mongoFunctions.find_one('EMPLOYEE',{'basic_info.email':req.employee.email});
    if(!employee) return res.status(400).send('No Employee Found With The Given Email');
    if (employee.work_info.admin_type !== "1" && employee.work_info.admin_type !== "2"){
      return res.status(400).send("Only Director or Manager Can Access The Change Password Route!");
    }
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

}));

//update dp

router.post(
    "/update_dp",
    Auth,rateLimit(60,10),Async((async (req, res) => {
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
      let update;
      if(data.image.length>10){
        if (!find_emp.images) {
        update = { images: { dp: data.image } };
      }
      else {
        update = { "images.dp": data.image };
      }
      }if(data.about_me.length>2){
        update = { "personal_details.about_me": data.about_me };
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
        data: {dp:update_emp.images.dp,about_me:update_emp.personal_details.about_me},
      });
    })
  ))

  router.post("/edit_profile",Auth,Async(async (req, res) =>{
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
    //    if (!Array.isArray(data.educational_details) || data.educational_details.length === 0) {
    //     return res.status(400).send("Educational details array must contain at least one entry.");
    // }
    let find_adhar = await mongoFunctions.find_one("EMPLOYEE", {
      $or: [
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


      let edit_emp_data = {
        "basic_info.nick_name": data.nick_name,
        "personal_details.expertise": data.expertise,
        "personal_details.marital_status": data.marital_status,
        "personal_details.about_me": data.about_me,

        identity_info: data.identity_info,
        // "contact_details.work_phone_number": data.work_phone_number,
        "contact_details.personal_email_address": data.personal_email_address,
        "contact_details.mobile_number": data.mobile_number,

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
      // await redis.update_redis("EMPLOYEE", update_emp);
      // console.log("updated emp in redis");
      return res.status(200).send({
        success: "Success",
        data: update_emp,
      });
    }));
    router.post("/update_task",rateLimit(60,10),Auth,Async(async(req, res)=>{
      const data = req.body;
      const { error } = validations.update_task(data);
      if(error) return res.status(400).send(error.details[0].message);
      const userRole = req.employee.role_name.toLowerCase();
      if(userRole==='1'){
        return res.status(403).send('Access denied: Not Team Member');
      }
      const findId = await mongoFunctions.find_one('TASKS',{
        organisation_id: req.employee.organisation_id,
        task_id: data.task_id,
        team: { $elemMatch: { employee_id: req.employee.employee_id } }
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
    }));

router.post("/apply_leave",Auth,rateLimit(60,10),Async(async(req,res) => {
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
  // find_hr=await mongoFunctions.find_one("EMPLOYEE", {
  //   "work_info.role_name": { $regex: new RegExp('^manager$', 'i') },
  //   "work_info.designation_name": { $regex: new RegExp('^hr manager$', 'i') }
  // });
  
  find_tl=await mongoFunctions.find_one("EMPLOYEE", {
    "work_info.admin_type": "3",
    // "work_info.role_name": { $regex: new RegExp('^team incharge$', 'i') },
    "work_info.department_id": req.employee.department_id,
  });
  let approved_by = {}
    approved_by.manager= {
      email: find_emp.work_info.reporting_manager,
      leave_status: "Pending",
    }
  
  if (req.employee.admin_type === "4") {
    approved_by.team_incharge = {
      employee_id: find_tl ? find_tl.employee_id : "",
      email: find_tl ? find_tl.basic_info.email : "",
      leave_status: "Pending",
    };
    // approved_by.hr = {
    //   employee_id: find_hr ? find_hr.employee_id : "",
    //   email: find_hr ? find_hr.basic_info.email : "",
    //   leave_status: "Pending",
    // };
  }
  
  if (req.employee.admin_type === "3") {
    // approved_by.hr = {
    //   employee_id: find_hr ? find_hr.employee_id : "",
    //   email: find_hr ? find_hr.basic_info.email : "",
    //   leave_status: "Pending",
    // };
  }



  const emp_leave_obj = find_emp.leaves.find(
    (e) => e.leave_id === data.leave_type
  );
  if (!emp_leave_obj)
    return res.status(400).send("Leave Type Not Found..!");
  const fromDate = new Date('2024-09-26');
  const toDate = new Date('2024-09-29');
  
  // Set the end of the day for toDate to include all times on that day
  toDate.setHours(23, 59, 59, 999);
  const over_lapping_leaves = await mongoFunctions.find("LEAVE", {
    organisation_id: find_emp.organisation_id,
    employee_id: find_emp.employee_id,
    // from_date: { $gte: new Date(data.from_date) },
    // to_date: { $lte: new Date(data.to_date )},
    from_date: { $gte: data.from_date},  
    to_date: { $lte:data.to_date},
  });
  console.log(new Date(data.from_date));

  console.log(over_lapping_leaves);

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
    department_id:find_emp.work_info.department_id,
    leave_type_id: emp_leave_obj.leave_id,
    leave_type: emp_leave_obj.leave_name,
    employee_name:
      find_emp.basic_info.first_name + " " + find_emp.basic_info.last_name,
    email: find_emp.basic_info.email,
    days_taken: leaves_count,
    from_date: data.from_date,
    to_date: data.to_date,
    reason: data.reason,
    // team_mail_id: data.team_mail_id,
    approved_by:approved_by,
    reporting_manager:find_emp.work_info.reporting_manager,
    leave_status: "Pending",
    // leaves:find_emp.leaves,
  };
  await mongoFunctions.create_new_record("LEAVE", leave_record_obj);
  return res.status(200).send({
    success: "Leave Applied Successfully...!",
  });
}));
  
  
  
  