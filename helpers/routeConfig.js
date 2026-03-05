const express = require("express");
const employee = require("../routes/emp_routes/emp");
const organisation = require("../routes/org_routes/org");
const employee_get = require("../routes/emp_routes/emp_get");
const admin_get = require("../routes/admin_routes/admin_get");
const admin = require("../routes/admin_routes/admin");
const error = require("../middlewares/error");
const queue = require("express-queue");
const super_admin = require("../routes/super_admin_routes/super_admin");
const events = require("../routes/org_routes/events");
const upload = require("../routes/upload");
const chat = require("../routes/chat");

module.exports = (app) => {
  // Middleware setup
  app.use(express.json());

  // Route handlers
  app.get("/", async (req, res) => {
    return res.status(200).send("Hello, Welcome to CRM Home 🚀");
  });

  // API routes
  app.use(
    "/emp",
    employee,
    queue({
      activeLimit: 1,
      queuedLimit: -1,
    })
  );
  app.use(
    "/org",
    organisation,
    queue({
      activeLimit: 1,
      queuedLimit: -1,
    })
  );
  app.use(
    "/emp_get",
    employee_get,
    queue({
      activeLimit: 1,
      queuedLimit: -1,
    })
  );
  app.use(
    "/admin_get",
    admin_get,
    queue({
      activeLimit: 1,
      queuedLimit: -1,
    })
  );
  app.use(
    "/admin",
    admin,
    queue({
      activeLimit: 1,
      queuedLimit: -1,
    })
  );
  app.use(
    "/super_admin",
    super_admin,
    queue({
      activeLimit: 1,
      queuedLimit: -1,
    })
  );
  app.use(
    "/crm",
    events,
    queue({
      activeLimit: 1,
      queuedLimit: -1,
    })
  );
  app.use(
    "/crm_up",
    upload,
    queue({
      activeLimit: 1,
      queuedLimit: -1,
    })
  );
  app.use(
    "/chat",
    chat,
    queue({
      activeLimit: 1,
      queuedLimit: -1,
    })
  );
};
