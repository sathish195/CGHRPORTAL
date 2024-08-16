const Joi = require('joi');
const moment = require("moment");

// Define schema for login employee
function emp_login(data) {
    const schema = Joi.object({
        email: Joi.string().required().email().max(55),
        password: Joi.string().required().min(8).max(10),
        last_ip: Joi.string().required(),
        fcm_token: Joi.string().required(),
        device_id: Joi.string().required(),
        browserid: Joi.string().required()
    });
    return schema.validate(data);
}
function emp_forgot_password(data) {
    const schema = Joi.object({
        email: Joi.string().required().email().max(55)
    });
    return schema.validate(data);
}
function emp_reset_forgot_password(data) {
    const schema = Joi.object({
        email: Joi.string().required().email().max(55),
        otp: Joi.string().required().min(6).max(6),
        new_password: Joi.string().required().min(8).max(10)
        .pattern(/(?=.*[A-Z])/,'uppercase')  // At least one uppercase letter
        .pattern(/(?=.*[@$!%*?&])/,'special') //atleast one special character
    });
    return schema.validate(data);
}
function emp_login_verify(data){
    const schema = Joi.object({
        email: Joi.string().required().email().max(55),
        otp: Joi.string().required().min(6).max(6),
        code2fa:Joi.string().allow(null, "").optional(),
        last_ip: Joi.string().required(),
        device_id: Joi.string().required(), // Add parentheses to call required() method
        browserid: Joi.string().required()

    });
    return schema.validate(data);
}
function emp_reset_password(data){
    const schema = Joi.object({
        old_password: Joi.string().required().min(8).max(10),
        new_password: Joi.string().required().min(8).max(10)
        .pattern(/(?=.*[A-Z])/,'uppercase')  // At least one uppercase letter
        .pattern(/(?=.*[@$!%*?&])/,'special') //atleast one special character
    });
    return schema.validate(data);
}

// const base64ImageSizeValidator = (value, helpers) => {
//     const buffer = Buffer.from(value, "base64");
//     const sizeInBytes = buffer.length;
//     const limitBytes = 250 * 1024;
//     if (sizeInBytes <= limitBytes) return value;
//     else return helpers.error("any.invalid");
//   };
function add_update_org(data){
    const schema = Joi.object({
        organisation_name: Joi.string().min(5).max(30).required(),
        organisation_type: Joi.string().min(2).max(15).required(),
        logo: Joi.string()
            // .custom(base64ImageSizeValidator, "Base64 Image Size Validation")
            .required()
            .messages({
            "any.invalid": "Size should be 250kb only", 
            }),
        org_mail_id: Joi.string()
            .email()
            .forbidden(/[\+]/, {
            message: "Email cannot contain the plus (+) character",
            })
            .lowercase()
            .max(55)
            .required(),
        address: Joi.string().required(),
        });
        return schema.validate(data);
}
function add_update_department(data){
    const schema = Joi.object({
        organisation_id: Joi.string().min(10).max(18).required(),
        department_name: Joi.string().trim().strip().min(5).max(20).required(),
        department_id: Joi.string().allow(null, "").optional(),
      });
      return schema.validate(data);
}
function add_update_designation(data){
    const leaves_obj = Joi.object({
        leave_name: Joi.string().required().min(4).max(15),
        total_leaves: Joi.number().required().min(1).max(10),
      });
    const schema = Joi.object({
        organisation_id: Joi.string().min(10).max(18).required(),
        designation_name: Joi.string().trim().strip().min(5).max(20).required(),
        designation_id: Joi.string().allow(null, "").optional(),
        leaves:Joi.array().items(leaves_obj).required(),
        // leave_id:Joi.string().allow(null, "").optional(),
        // leave_name: Joi.string().trim().strip().allow(null, "").optional(),
        // max_leaves:Joi.number().allow(null, "").optional().optional(),
      });
      return schema.validate(data);
}
function add_update_role(data){
    const schema = Joi.object({
        organisation_id: Joi.string().min(10).max(18).required(),
        role_name: Joi.string().trim().strip().min(5).max(20).required(),
        role_id: Joi.string().allow(null, "").optional(),
      });
      return schema.validate(data);
}
const validate_dob = (value, helpers) => {
    // Check if the date format is valid
    if (!moment(value, "DDMMYYYY", true).isValid()) {
      return helpers.message("Invalid date format");
    }
  
    // Check if age is 18 years or above
    const dob = moment(value, "DDMMYYYY");
    const age = moment().diff(dob, "years");
  
    if (age < 18) {
      return helpers.message("Employee must be 18 years old..!");
    }
  
    return value; // Return the validated value
  };
function add_employee_by_admin(data){
    const work_experience_obj = Joi.object({
        company_name: Joi.string().min(3).max(30).required(),
        job_title: Joi.string().min(2).max(25).required(),
        from_date: Joi.date().required(),
        to_date: Joi.date().required(),
        job_description: Joi.string().min(5).max(100).pattern(/^[A-Za-z0-9\s.,-]+$/, 'valid characters').required().messages({
            'string.pattern.base': 'can only contain letters, numbers, spaces, periods, commas, and hyphens.',
        }),
        experience: Joi.number().positive().required(),
      });
      const educational_details_obj = Joi.object({
        institute_name: Joi.string().min(5).max(30).required(),
        degree: Joi.string().min(5).max(15).required(),
        specialization: Joi.string().min(3).max(15).required(),
        year_of_completion: Joi.number().required(),
      });
      const dependent_details_obj = Joi.object({
        name: Joi.string(),
        relation: Joi.string(),
        dependent_date_of_birth: Joi.date(),
      });
      const schema = Joi.object({
        organisation_id: Joi.string().min(15).max(17).required(),
        employee_id: Joi.string().min(5).max(10).required(),
        email: Joi.string()
          .pattern(/^[a-z0-9._]+@[a-z0-9.-]+\.[a-z]{2,}$/)
          .trim()
          .min(10)
          .max(55)
          .email()
          .messages({
            "string.pattern.base": "Email Should be valid mail",
          })
          .required(),
        first_name: Joi.string().min(3).max(15).required(),
        last_name: Joi.string().min(3).max(15).required(),
        nick_name: Joi.string().max(15).allow(null, "").optional(),
        department_id: Joi.string().min(3).max(15).required(),
        role_id: Joi.string().min(3).max(15).required(),
        designation_id: Joi.string().min(3).max(15).required(),
        employment_type: Joi.string().min(3).max(15).required(),
        employee_status: Joi.string()
          .valid("active", "disable", "terminated")
          .min(5)
          .max(15)
          .required(),
        source_of_hire: Joi.string().min(3).max(15).required(),
        reporting_manager: Joi.string().required(),
        date_of_join: Joi.date().required(),
  
        date_of_birth: Joi.string()
          .regex(/^\d{2}\d{2}\d{4}$/)
          .message("Date must be in DDMMYYYY format")
          .required()
          .custom(validate_dob),
        expertise: Joi.string().allow(null, "").optional(),
        gender: Joi.string().valid("male", "female", "others").required(),
        marital_status: Joi.string().valid("married", "unmarried").required(),
        about_me: Joi.string().allow(null, "").optional(),
        identity_info: Joi.object().min(2).required(),
        work_phone_number: Joi.string().allow(null, "").optional(),
        personal_mobile_number: Joi.string().required(),
        personal_email_address: Joi.string()
          .pattern(/^[a-z0-9._]+@[a-z0-9.-]+\.[a-z]{2,}$/)
          .trim()
          .min(10)
          .max(55)
          .email()
          .messages({
            "string.pattern.base": "Email Should be valid mail",
          })
          .required(),
        seating_location: Joi.string().allow(null, "").optional(),
        present_address: Joi.string().min(10).max(100).pattern(/^[A-Za-z0-9\s.,-]+$/, 'valid characters').messages({
            'string.pattern.base': 'can only contain letters, numbers, spaces, periods, commas, and hyphens.',
        }).required(),
        permanent_address: Joi.string().min(10).max(100).pattern(/^[A-Za-z0-9\s.,-]+$/, 'valid characters').messages({
            'string.pattern.base': 'can only contain letters, numbers, spaces, periods, commas, and hyphens.',
        }).required(),
        work_experience: Joi.array().items(work_experience_obj).required(),
        educational_details: Joi.array()
          .items(educational_details_obj)
          .required(),
        dependent_details: Joi.array()
          .items(dependent_details_obj)
          .required(),
      });
      return schema.validate(data);
    }
    //common validation
    function employee_id (data){
        const schema = Joi.object({
          employee_id: Joi.string().min(5).max(20).required(),
        });
        return schema.validate(data);
      }
      function add_image (data) {
        const schema = Joi.object({
          image: Joi.string()
            .required()
            .messages({
              "any.invalid": "Size should be 250kb only", // Define the custom error message
            }),
        });
        return schema.validate(data);
      }
      
      function skip (data){
        const schema = Joi.object({
          skip: Joi.number().min(0).required(),
        });
        return schema.validate(data);
      }
      function edit_profile(data){
        const work_experience_obj = Joi.object({
            company_name: Joi.string().min(3).max(30).required(),
            job_title: Joi.string().min(2).max(25).required(),
            from_date: Joi.date().required(),
            to_date: Joi.date().required(),
            job_description: Joi.string().min(5).max(100).pattern(/^[A-Za-z0-9\s.,-]+$/, 'valid characters').required().messages({
                'string.pattern.base': 'can only contain letters, numbers, spaces, periods, commas, and hyphens.',
            }),
            experience: Joi.number().positive().required(),
          });
          const educational_details_obj = Joi.object({
            institute_name: Joi.string().min(5).max(30).required(),
            degree: Joi.string().min(5).max(15).required(),
            specialization: Joi.string().min(3).max(15).required(),
            year_of_completion: Joi.number().required(),
          });
          const dependent_details_obj = Joi.object({
            name: Joi.string(),
            relation: Joi.string(),
            dependent_date_of_birth: Joi.date(),
          });
          const schema = Joi.object({
            organisation_id: Joi.string().min(15).max(17).required(),
            employee_id: Joi.string().min(5).max(10).required(),
            nick_name: Joi.string().max(15).allow(null, "").optional(),
            expertise: Joi.string().allow(null, "").optional(),
            marital_status: Joi.string().valid("married", "unmarried").required(),
            about_me: Joi.string().allow(null, "").optional(),
            identity_info: Joi.object().required(),
            work_phone_number: Joi.string().allow(null, "").optional(),
            personal_mobile_number: Joi.string().required(),
            personal_email_address: Joi.string()
              .pattern(/^[a-z0-9._]+@[a-z0-9.-]+\.[a-z]{2,}$/)
              .trim()
              .min(10)
              .max(55)
              .email()
              .messages({
                "string.pattern.base": "Email Should be valid mail",
              })
              .required(),
            work_experience: Joi.array().items(work_experience_obj).required(),
            educational_details: Joi.array()
              .items(educational_details_obj)
              .required(),
            dependent_details: Joi.array().items(dependent_details_obj).required(),
            last_ip: Joi.string().ip().required(),
            browserid: Joi.string().min(3).max(50).required(),
            fcm_token: Joi.string().min(3).max(50).required(),
            device_id: Joi.string().min(3).max(50).required(),
          });
          return schema.validate(data);
        
      }
    function add_project(data){
        const schema = Joi.object({
            project_name: Joi.string().min(3).max(50).required(),
            description: Joi.string().min(10).max(200).pattern(/^[A-Za-z0-9\s.,-]+$/, 'valid characters').required().messages({
                'string.pattern.base': 'can only contain letters, numbers, spaces, periods, commas, and hyphens.',
            }),
            start_date:Joi.date().required(),
            end_date:Joi.date().required(),
            status: Joi.string().valid("new", "in_progress","under_review", "completed").required(),
            // team: Joi.array().items(team_obj).min(1).required(),
            project_status: Joi.string().valid("active","in_active","terminated").required(),
            project_id: Joi.string().optional().allow(""),
        });
        return schema.validate(data);
    }
    function add_remove_team(data){
        const schema = Joi.object({
            status: Joi.string().valid("remove","add").required(),
            employee_id:Joi.string().min(5).max(12).required(),
            project_id: Joi.string().min(5).max(12).required(),
        });
        return schema.validate(data);
    }
    
    function get_project_by_id(data){
        const schema = Joi.object({
            project_id: Joi.string().min(5).max(12).required(),
        });
        return schema.validate(data);
    }
// Export the functions
module.exports = { emp_login,emp_forgot_password,emp_reset_forgot_password ,emp_login_verify,emp_reset_password,add_update_org,add_update_department,add_update_designation
    ,add_update_role ,add_employee_by_admin,employee_id,skip,add_image,edit_profile,add_project,get_project_by_id,add_remove_team,
};
