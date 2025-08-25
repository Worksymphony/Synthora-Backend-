const express = require("express");
const cors = require("cors");
const uploadRoutes = require("./src/routes/uploadroute");
const getmetadata=require("./src/routes/getmetadata")
const uploadjdRoutes=require("./src/routes/uploadjdRoutes")
const getjd=require("./src/routes/getjd")
const getaireport =require('./src/routes/getaireport')
const getmatching=require("./src/routes/getmatching")
const getaians=require("./src/routes/getaians")
const deleteAuthUser =require('./src/routes/deleteAuthUser')
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/api/upload", uploadRoutes);
app.use("/api/getmetadata",getmetadata)
app.use("/api/job_description",uploadjdRoutes)
app.use("/api/getjobdesc",getjd)
app.use("/api/uploadjd",uploadjdRoutes)
app.use("/api/candidatecount",getmetadata)
app.use("/api/hiredcount",getmetadata)
app.use("/api/aireport",getaireport)
app.use("/api/matching",getmatching)
app.use("/api/askai",getaians)
app.use("/api/deleteAuthUser",deleteAuthUser)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
