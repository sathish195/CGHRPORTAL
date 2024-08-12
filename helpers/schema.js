const Joi = require('joi');

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
        organisation_name: Joi.string().min(5).max(15).required(),
        organisation_type: Joi.string().min(2).max(15).required(),
        logo: Joi.string()
            // .custom(base64ImageSizeValidator, "Base64 Image Size Validation")
            .required()
            .messages({
            "any.invalid": "Size should be 250kb only", // Define the custom error message
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
    const schema = Joi.object({
        organisation_id: Joi.string().min(10).max(18).required(),
        designation_name: Joi.string().trim().strip().min(5).max(20).required(),
        designation_id: Joi.string().allow(null, "").optional(),
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
// Export the functions
module.exports = { emp_login,emp_forgot_password,emp_reset_forgot_password ,emp_login_verify,emp_reset_password,add_update_org,add_update_department,add_update_designation
    ,add_update_role 
};
