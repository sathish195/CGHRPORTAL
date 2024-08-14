const mongoose = require("mongoose");

const Project_schema=new mongoose.Schema({
    project_id: { type: String, required: true, unique: true },
    project_name: { type: String, required: true },
    project_description: { type: String, required: true },
    project_deadline: { type: Date, required: true },
    project_status: { type: String, required: true },
    team_members: { type: Array,required:true },
    team_incharges: { type: Array, required: true },
},
{ timestamps: true }
);

exports.PROJECTS= mongoose.model("PROJECTS", Project_schema);