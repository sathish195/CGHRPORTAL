const mongoose = require("mongoose");
// ====== Common sub-schemas ======
const toggleField = { type: Boolean, default: false };

const scopeSchema = new mongoose.Schema(
  {
    reportingManager: toggleField,
    allEmployees: toggleField,
    team: toggleField,
  },
  { _id: false }
);

const typeSchema = new mongoose.Schema(
  {
    view: toggleField,
    edit: toggleField,
    scope: { type: scopeSchema, default: undefined },
  },
  { _id: false }
);

const simpleTypeSchema = new mongoose.Schema(
  {
    yesNo: toggleField,
  },
  { _id: false }
);

const allAssignedSchema = new mongoose.Schema(
  {
    all: {
      view: toggleField,
      edit: toggleField,
    },
    assignedTo: {
      view: toggleField,
      edit: toggleField,
    },
  },
  { _id: false }
);

// ====== Combined organisation + controls schema ======
const org_level_controls_schema = new mongoose.Schema(
  {
    // --- Organisation details ---
    organisation_id: { type: String, required: true, unique: true },
    organisation_name: { type: String, required: true },
    email: { type: String, required: true },
    employee_id: { type: String, required: true },

    // --- Permissions block ---
    controls: {
      leaveApplications: {
        2: {
          view: toggleField,
          edit: toggleField,
          scope: {
            reportingManager: toggleField,
            allEmployees: toggleField,
          },
        },
        3: {
          view: toggleField,
          edit: toggleField,
          scope: {
            team: toggleField,
            reportingManager: toggleField,
          },
        },
        4: typeSchema,
      },
      attendance: {
        2: {
          view: toggleField,
          edit: toggleField,
          scope: {
            reportingManager: toggleField,
            allEmployees: toggleField,
          },
        },
        3: {
          view: toggleField,
          edit: toggleField,
          scope: {
            team: toggleField,
            reportingManager: toggleField,
          },
        },
        4: typeSchema,
      },
      rm: {
        2: simpleTypeSchema,
        3: simpleTypeSchema,
        4: simpleTypeSchema,
      },
      addEmployee: {
        2: simpleTypeSchema,
        3: simpleTypeSchema,
        4: simpleTypeSchema,
      },
      employeeList: {
        2: typeSchema,
        3: typeSchema,
        4: typeSchema,
      },
      managementSettings: {
        2: typeSchema,
        3: typeSchema,
        4: typeSchema,
      },
      companySettings: {
        2: typeSchema,
        3: typeSchema,
        4: typeSchema,
      },
      changePassword: {
        2: simpleTypeSchema,
        3: simpleTypeSchema,
        4: simpleTypeSchema,
      },
      leads: {
        2: allAssignedSchema,
        3: allAssignedSchema,
        4: allAssignedSchema,
      },
      posts: {
        2: typeSchema,
        3: typeSchema,
        4: typeSchema,
      },
      calendar: {
        2: allAssignedSchema,
        3: allAssignedSchema,
        4: allAssignedSchema,
      },
      projects: {
        2: allAssignedSchema,
        3: allAssignedSchema,
        4: allAssignedSchema,
      },
    },
  },
  { timestamps: true }
);

// Index for fast lookup
org_level_controls_schema.index({ organisation_id: 1 });

exports.ORG_LEVEL_CONTROLS = mongoose.model(
  "ORG_LEVEL_CONTROLS",
  org_level_controls_schema
);
