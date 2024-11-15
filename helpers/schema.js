const Joi = require("joi");
const moment = require("moment");

// Define schema for login employee
function emp_login(data) {
  const schema = Joi.object({
    email: Joi.string().required().max(55),
    password: Joi.string().required().min(8).max(15),
    last_ip: Joi.string().required(),
    fcm_token: Joi.string().required(),
    device_id: Joi.string().required(),
    browserid: Joi.string().required(),
  });
  return schema.validate(data);
}
function emp_forgot_password(data) {
  const schema = Joi.object({
    email: Joi.string().required().email().max(55),
  });
  return schema.validate(data);
}
function emp_reset_password_by_admin(data) {
  const schema = Joi.object({
    email: Joi.string().required().email().max(55),
    new_password: Joi.string()
      .required()
      .min(8)
      .max(15)
      .pattern(/(?=.*[A-Z])/, "uppercase") // At least one uppercase letter
      .pattern(/(?=.*[@$!%*?&])/, "special"), //atleast one special character
  });
  return schema.validate(data);
}
function emp_reset_forgot_password(data) {
  const schema = Joi.object({
    employee_email: Joi.string().required().email().max(55),
    // otp: Joi.string().required().min(6).max(6),
    new_password: Joi.string()
      .required()
      .min(8)
      .max(15)
      .pattern(/(?=.*[A-Z])/, "uppercase") // At least one uppercase letter
      .pattern(/(?=.*[@$!%*?&])/, "special"), //atleast one special character
  });
  return schema.validate(data);
}
function emp_login_verify(data) {
  const schema = Joi.object({
    email: Joi.string().required().email().max(55),
    otp: Joi.string().required().min(6).max(6),
    code2fa: Joi.string().allow(null, "").optional(),
    last_ip: Joi.string().required(),
    device_id: Joi.string().required(), // Add parentheses to call required() method
    browserid: Joi.string().required(),
  });
  return schema.validate(data);
}
function emp_reset_password(data) {
  const schema = Joi.object({
    old_password: Joi.string().required().min(8).max(15),
    new_password: Joi.string()
      .required()
      .min(8)
      .max(15)
      .pattern(/(?=.*[A-Z])/, "uppercase") // At least one uppercase letter
      .pattern(/(?=.*[@$!%*?&])/, "special"), //atleast one special character
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
function add_update_org(data) {
  const schema = Joi.object({
    organisation_name: Joi.string().min(5).max(50).required().trim(),
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
    address: Joi.string().min(5).max(100).required(),
  });
  return schema.validate(data);
}
function add_update_department(data) {
  const schema = Joi.object({
    organisation_id: Joi.string().min(10).max(18).required(),
    department_name: Joi.string().trim().strip().min(5).max(50).required(),
    department_id: Joi.string().allow(null, "").optional(),
  });
  return schema.validate(data);
}
function add_update_designation(data) {
  // const leaves_obj = Joi.object({
  //     leave_name: Joi.string().required().min(4).max(15),
  //     total_leaves: Joi.number().required().min(1).max(10),
  //   });
  const schema = Joi.object({
    organisation_id: Joi.string().min(10).max(18).required(),
    designation_name: Joi.string().trim().strip().min(5).max(40).required(),
    designation_id: Joi.string().allow(null, "").optional(),
    // leaves:Joi.array().items(leaves_obj).required(),
    // leave_id:Joi.string().allow(null, "").optional(),
    // leave_name: Joi.string().trim().strip().allow(null, "").optional(),
    // max_leaves:Joi.number().allow(null, "").optional().optional(),
  });
  return schema.validate(data);
}
function add_update_role(data) {
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
const validateDates = (value, helpers) => {
  const { from_date, to_date } = value;

  if (to_date < from_date) {
    return helpers.message(
      '"to_date" must be greater than or equal to "from_date"'
    );
  }

  return value;
};
function add_employee_by_admin(data) {
  const work_experience_obj = Joi.object({
    company_name: Joi.string().trim().min(3).max(30).required(),
    job_title: Joi.string().trim().min(2).max(25).required(),
    from_date: Joi.date().required(),
    to_date: Joi.date().required(),
    job_description: Joi.string()
      .regex(/^\S.*\S$/)
      .trim()
      .min(5)
      .max(100)
      .pattern(/^[A-Za-z0-9\s.,-]+$/, "valid characters")
      .required()
      .messages({
        "string.pattern.base":
          "job description can only contain letters, numbers, spaces, periods, commas, and hyphens.",
      }),
    // experience: Joi.number().positive().required(),
  }).custom(validateDates, "date comparison validation");
  const educational_details_obj = Joi.object({
    institute_name: Joi.string().trim().min(2).max(50).required(),
    degree: Joi.string().trim().min(3).max(15).required(),
    specialization: Joi.string().trim().min(2).max(30).required(),
    year_of_completion: Joi.number().required(),
  });
  const dependent_details_obj = Joi.object({
    name: Joi.string().trim(),
    relation: Joi.string().trim(),
    dependent_mobile_number: Joi.string().trim(),
  });
  const schema = Joi.object({
    organisation_id: Joi.string().trim().min(15).max(17).required(),
    employee_id: Joi.string()
      .trim()
      .min(5)
      .max(10)
      .regex(/^[A-Z0-9]+$/)
      .required()
      .messages({
        "string.base": "Employee ID must be a string",
        "string.min": "Employee ID must be at least 5 characters long",
        "string.max": "Employee ID must be at most 10 characters long",
        "string.pattern.base":
          "Employee ID can only contain uppercase letters and digits",
        "any.required": "Employee ID is required",
      }),
    password: Joi.string().trim().allow(null, "").optional(),
    // .required()
    // .min(8)
    // .max(60)
    // .pattern(/(?=.*[A-Z])/, "uppercase") // At least one uppercase letter
    // .pattern(/(?=.*[@$!%*?&])/, "special"), //atleast one special character
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
    first_name: Joi.string().trim().min(3).max(50).required(),
    last_name: Joi.string().trim().min(3).max(50).required(),
    nick_name: Joi.string().trim().max(15).allow(null, "").optional(),
    department_id: Joi.string().trim().min(3).max(15).required(),
    role_id: Joi.string().trim().min(3).max(15).required(),
    designation_id: Joi.string().trim().min(3).max(15).required(),
    employment_type: Joi.string().trim().min(3).max(15).required(),
    employee_status: Joi.string()
      .valid("active", "disable", "terminated")
      .trim()
      .min(5)
      .max(15)
      .required(),
    source_of_hire: Joi.string().trim().min(3).max(15).required(),
    reporting_manager: Joi.string().required(),
    date_of_join: Joi.date().required(),

    date_of_birth: Joi.date().required(),
    // Joi.string()
    //   .regex(/^\d{2}\d{2}\d{4}$/)
    //   .message("Date must be in DDMMYYYY format")
    //   .required()
    //   .custom(validate_dob),
    expertise: Joi.string().trim().allow(null, "").optional(),
    gender: Joi.string().valid("male", "female", "others").trim().required(),
    marital_status: Joi.string()
      .valid("married", "unmarried")
      .trim()
      .required(),
    about_me: Joi.string().trim().allow(null, "").optional().trim(),
    identity_info: Joi.object().min(2).required(),
    mobile_number: Joi.string().trim().allow(null, "").optional(),
    // mobile_number: Joi.string().min(10).max(10).required(),
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
    seating_location: Joi.string().trim().allow(null, "").optional(),
    present_address: Joi.string()
      .trim()
      .min(10)
      .max(100)
      .pattern(/^[A-Za-z0-9\s.,/()-]+$/, "valid characters")
      .messages({
        "string.pattern.base":
          "present address can only contain letters, numbers, spaces, periods, commas, and hyphens.",
      })
      .required(),
    permanent_address: Joi.string()
      .trim()
      .min(10)
      .max(100)
      .pattern(/^[A-Za-z0-9\s.,/()-]+$/, "valid characters")
      .messages({
        "string.pattern.base":
          "permanent address can only contain letters, numbers, spaces, periods, commas, and hyphens.",
      })
      .required(),
    work_experience: Joi.array().items(work_experience_obj).required(),
    educational_details: Joi.array().items(educational_details_obj).required(),
    dependent_details: Joi.array().items(dependent_details_obj).required(),
  });
  return schema.validate(data);
}
//common validation
function employee_id(data) {
  const schema = Joi.object({
    employee_id: Joi.string().min(5).max(20).required(),
  });
  return schema.validate(data);
}
function add_image(data) {
  const schema = Joi.object({
    image: Joi.string().allow(null, "").optional(),
    // Joi.string()
    //   .required()
    //   .messages({
    //     "any.invalid": "Size should be 250kb only", // Define the custom error message
    //   }),
    about_me: Joi.string().allow(null, "").optional().trim(),
  });
  return schema.validate(data);
}

function skip(data) {
  const schema = Joi.object({
    skip: Joi.number().min(0).required(),
  });
  return schema.validate(data);
}
function edit_profile(data) {
  const work_experience_obj = Joi.object({
    company_name: Joi.string().min(3).max(30).required().trim(),
    job_title: Joi.string().min(2).max(25).required(),
    from_date: Joi.date().required(),
    to_date: Joi.date().required(),
    job_description: Joi.string()
      .min(5)
      .max(100)
      .pattern(/^[A-Za-z0-9\s.,-]+$/, "valid characters")
      .required()
      .messages({
        "string.pattern.base":
          "can only contain letters, numbers, spaces, periods, commas, and hyphens.",
      })
      .trim(),
    // experience: Joi.number().positive().required(),
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
    dependent_mobile_number: Joi.string(),
  });
  const schema = Joi.object({
    organisation_id: Joi.string().min(15).max(17).required(),
    employee_id: Joi.string()
      .min(5)
      .max(10)
      .regex(/^[A-Z0-9]+$/)
      .required()
      .messages({
        "string.base": "Employee ID must be a string",
        "string.min": "Employee ID must be at least 5 characters long",
        "string.max": "Employee ID must be at most 10 characters long",
        "string.pattern.base":
          "Employee ID can only contain uppercase letters and digits",
        "any.required": "Employee ID is required",
      }),
    nick_name: Joi.string().max(15).allow(null, "").optional(),
    expertise: Joi.string().allow(null, "").optional(),
    marital_status: Joi.string().valid("married", "unmarried").required(),
    about_me: Joi.string().allow(null, "").optional().trim(),
    identity_info: Joi.object().required(),
    mobile_number: Joi.string().allow(null, "").optional(),
    // personal_mobile_number: Joi.string().required(),
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
    educational_details: Joi.array().items(educational_details_obj).required(),
    dependent_details: Joi.array().items(dependent_details_obj).required(),
    last_ip: Joi.string().ip().required(),
    browserid: Joi.string().min(3).max(50).required(),
    fcm_token: Joi.string().min(3).max(50).required(),
    device_id: Joi.string().min(3).max(50).required(),
  });
  return schema.validate(data);
}
function add_project(data) {
  const schema = Joi.object({
    project_name: Joi.string().min(3).max(50).required().trim(),
    description: Joi.string()
      .trim()
      .min(10)
      .max(200)
      .pattern(/^[A-Za-z0-9\s.,-]+$/, "valid characters")
      .required()
      .messages({
        "string.pattern.base":
          "can only contain letters, numbers, spaces, periods, commas, and hyphens.",
      }),
    start_date: Joi.date().required(),
    end_date: Joi.date().required(),
    status: Joi.string()
      .valid("new", "in_progress", "under_review", "completed")
      .required(),
    // team: Joi.array().items(team_obj).min(1).required(),
    project_status: Joi.string()
      .valid("active", "in_active", "completed")
      .required(),
    project_id: Joi.string().optional().allow(""),
  });
  return schema.validate(data);
}
function add_remove_team(data) {
  const schema = Joi.object({
    action: Joi.string().valid("remove", "add").required(),
    employee_id: Joi.array().min(1).required().messages({
      "array.min": "You Must Provide At Least One Employee Id To Update Team.",
    }),
    project_id: Joi.string().min(5).max(12).required(),
    task_id: Joi.string().optional().allow(""),
  });
  return schema.validate(data);
}
function update_task_team(data) {
  const schema = Joi.object({
    action: Joi.string().valid("remove", "add").required(),
    employee_id: Joi.string().required(),
    project_id: Joi.string().min(5).max(12).required(),
    task_id: Joi.string().required(),
  });
  return schema.validate(data);
}
function add_update_task(data) {
  const schema = Joi.object({
    project_id: Joi.string().min(5).max(12).required(),
    task_name: Joi.string().min(3).max(50).required().trim(),
    description: Joi.string()
      .trim()
      .min(10)
      .max(200)
      .pattern(/^[A-Za-z0-9\s.,-]+$/, "valid characters")
      .required()
      .messages({
        "string.pattern.base":
          "can only contain letters, numbers, spaces, periods, commas, and hyphens.",
      })
      .trim(),
    status: Joi.string()
      .valid("new", "in_progress", "under_review", "completed", "manager")
      .required(),
    due_date: Joi.string().required(),
    priority: Joi.string().valid("high", "medium", "low").required(),
    task_status: Joi.string()
      .valid("active", "in_active", "completed")
      .required(),
    task_id: Joi.string().optional().allow(""),
    action: Joi.string().valid("remove", "add").required(),
    employee_id: Joi.string().required(),
    completed_date: Joi.date().optional().allow(""),
  });
  return schema.validate(data);
}

function get_project_by_id(data) {
  const schema = Joi.object({
    project_id: Joi.string().min(5).max(12).required(),
  });
  return schema.validate(data);
}
function get_tasks(data) {
  const schema = Joi.object({
    project_id: Joi.string().optional().allow(""),
  });
  return schema.validate(data);
}
function get_task_by_id(data) {
  const schema = Joi.object({
    task_id: Joi.string().min(5).max(12).required(),
  });
  return schema.validate(data);
}
function update_project(data) {
  const schema = Joi.object({
    project_id: Joi.string().min(5).max(12).required(),
    status: Joi.string()
      .valid("new", "in_progress", "under_review", "completed")
      .required(),
  });
  return schema.validate(data);
}
function update_task(data) {
  const schema = Joi.object({
    task_id: Joi.string().min(5).max(12).required(),
    status: Joi.string()
      .valid("new", "in_progress", "under_review", "completed", "hold")
      .required(),
  });
  return schema.validate(data);
}
function get_all_tasks(data) {
  const schema = Joi.object({
    skip: Joi.number().integer().min(0).required(),
    status: Joi.string()
      .optional()
      .allow("")
      .valid("new", "in_progress", "under_review", "completed", "hold"),
    date: Joi.date().optional().allow(""),
  });
  return schema.validate(data);
}
function update_leaves(data) {
  const schema = Joi.object({
    organisation_id: Joi.string().min(5).max(20).required(),
    role_id: Joi.string().min(5).max(15).required(),
    leave_name: Joi.string().required().min(4).max(15).trim(),
    total_leaves: Joi.number().required().min(1).max(100),
    leave_id: Joi.string().optional().allow(""),
  });
  return schema.validate(data);
}
function apply_leave(data) {
  const schema = Joi.object({
    from_date: Joi.date().required(),
    to_date: Joi.date().required().min(Joi.ref("from_date")).messages({
      "date.min": '"to_date" must be on or after "from_date"',
    }),
    leave_type: Joi.string().min(9).required(),
    reason: Joi.string()
      .pattern(/^[a-zA-Z0-9.,_()[\]& ]+$/)
      .trim()
      .min(5)
      .max(100)
      .messages({
        "string.pattern.base": "Invalid characters found.",
        "string.min": "The reason must be at least 5 characters long.",
        "string.max": "The reason must be no more than 200 characters long.",
      })
      .required(),
    // team_mail_id: Joi.string()
    // .pattern(/^[a-z0-9._]+@[a-z0-9.-]+\.[a-z]{2,}$/)
    // .trim()
    // .min(10)
    // .max(55)
    // .email()
    // .messages({
    //   "string.pattern.base": "Email Should be valid mail",
    // })
    // .required(),
  });
  return schema.validate(data);
}
function update_leave(data) {
  const schema = Joi.object({
    leave_application_id: Joi.string().min(5).max(20).required(),
    leave_status: Joi.string().valid("Approved", "Rejected").required(),
  });
  return schema.validate(data);
}
function get_all_leave_applications(data) {
  const schema = Joi.object({
    skip: Joi.number().min(0).required(),
    leave_status: Joi.string()
      .valid("Approved", "Rejected", "Pending")
      .optional()
      .allow(""),
    employee_id: Joi.string().optional().allow(""),
    // name:Joi.string().optional().allow(""),
    year: Joi.number().positive().optional(),
    month: Joi.number().min(1).max(12).optional(),
  });
  return schema.validate(data);
}
function get_employee_leave_applications(data) {
  const schema = Joi.object({
    skip: Joi.number().min(0).required(),
    leave_status: Joi.string()
      .valid("Approved", "Rejected", "Pending")
      .optional()
      .allow(""),
    year: Joi.number().positive().optional(),
    month: Joi.number().min(1).max(12).optional(),
  });
  return schema.validate(data);
}
function get_team_for_task(data) {
  const schema = Joi.object({
    skip: Joi.number().min(0).required(),
    leave_status: Joi.string()
      .valid("Approved", "Rejected", "Pending")
      .optional()
      .allow(""),
    year: Joi.string().optional().allow(""),
  });
  return schema.validate(data);
}
function get_team(data) {
  const schema = Joi.object({
    name: Joi.string().optional(),
  });
  return schema.validate(data);
}

//checkin and checkout

function checkin_checkout(data) {
  const schema = Joi.object({
    type: Joi.string().valid("checkin", "checkout").required(),
    latitude: Joi.string().min(5).required(),
    longitude: Joi.string().min(5).required(),
    location: Joi.string().required(),
    ip: Joi.string().ip().required(),
  });
  return schema.validate(data);
}
//update attendance

function checkin_checkout_update(data) {
  const schema = Joi.object({
    attendance_id: Joi.string().min(5).max(20).required(),
    in_time: Joi.date().optional().allow(""),
    out_time: Joi.date().optional().allow(""),
    latitude: Joi.string().min(5).required(),
    longitude: Joi.string().min(5).required(),
    location: Joi.string().required(),
    ip: Joi.string().ip().required(),
  });
  return schema.validate(data);
}

function get_emp_attendance_by_filter(data) {
  const schema = Joi.object({
    year: Joi.number().positive().required(),
    month: Joi.number().min(1).max(12).required(),
    week_date: Joi.date().optional().allow(""),
  });
  return schema.validate(data);
}
function get_emp_attendance_by_admin(data) {
  const schema = Joi.object({
    year: Joi.number().positive().required(),
    month: Joi.number().min(1).max(12).required(),
    employee_id: Joi.string().optional().allow(""),
    week_date: Joi.date().optional().allow(""),
  });
  return schema.validate(data);
}
function add_admin_emp(data) {
  const schema = Joi.object({
    employee_id: Joi.string().required().min(5).max(15),
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
  });
  return schema.validate(data);
}
function add_holidays(data) {
  const schema = Joi.object({
    organisation_id: Joi.string().min(10).max(18).required(),
    holiday_name: Joi.string().trim().min(5).max(50).required(),
    holiday_date: Joi.date().required(),
    holiday_id: Joi.string().allow(null, "").optional(),
  });
  return schema.validate(data);
}
function get_attendance_stats(data) {
  const schema = Joi.object({
    date: Joi.date().optional().allow(""),
  });
  return schema.validate(data);
}
function delete_data(data) {
  const schema = Joi.object({
    id: Joi.string().required(),
  });
  return schema.validate(data);
}
function tasks_count(data) {
  const schema = Joi.object({
    employee_id: Joi.string().required(),
    from_date: Joi.string().required(),
    to_date: Joi.string().required(),
  });
  return schema.validate(data);
}

// Export the functions
module.exports = {
  emp_login,
  emp_forgot_password,
  emp_reset_forgot_password,
  emp_login_verify,
  emp_reset_password,
  add_update_org,
  add_update_department,
  add_update_designation,
  add_update_role,
  add_employee_by_admin,
  employee_id,
  skip,
  add_image,
  edit_profile,
  add_project,
  get_project_by_id,
  add_remove_team,
  add_update_task,
  get_task_by_id,
  update_project,
  update_task,
  update_leaves,
  get_all_tasks,
  apply_leave,
  update_leave,
  get_all_leave_applications,
  get_employee_leave_applications,
  get_team,
  emp_reset_password_by_admin,
  checkin_checkout,
  checkin_checkout_update,
  get_emp_attendance_by_filter,
  get_emp_attendance_by_admin,
  add_admin_emp,
  add_holidays,
  get_attendance_stats,
  delete_data,
  update_task_team,
  tasks_count,
  get_tasks,
};
