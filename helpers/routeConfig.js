const express = require("express");
const employee= require("../routes/emp_routes/emp");
const organisation= require("../routes/org_routes/org");
const employee_get= require("../routes/emp_routes/emp_get");
const admin_get= require("../routes/admin_routes/admin_get");
const admin=require("../routes/admin_routes/admin");
module.exports = (app) => {
  // Middleware setup
  app.use(express.json()); // Ensure proper middleware for JSON parsing

  // Route handlers
  app.get("/", async (req, res) => {
    return res.status(200).send("Hello, Welcome to CRM Home 🚀");
  });

  // API routes
  app.use("/emp", employee);
  app.use("/org", organisation);
  app.use("/emp_get", employee_get);
  app.use("/admin_get", admin_get);
  app.use("/admin",admin);
};