const mongoose = require("mongoose");

const Project_schema=new mongoose.Schema({
    project_id: { type: String, required: true, unique: true },
    project_name: { type: String, required: true },
    description: { type: String, required: true },
    deadline: { type: String, required: true },
    status: { type: String, required: true },
    team: { type: Array, required: true },
    created_by:{ type: String, required: true },
    modified_by:{ type: String, required: true },

},
{ timestamps: true }
);

exports.PROJECTS= mongoose.model("PROJECTS", Project_schema);