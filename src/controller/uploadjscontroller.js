const { bucket, admin } = require("../config/firebase");
const db=admin.firestore()
const {getEmbedding}=require("../utils/getembedding")
const {
  extractTextFromPDF,
  extractTextFromDocx,
  extractJobDetailsFromText,
  extractJDMetadataFromText
} = require("../utils/extractmetadata");
const fs = require("fs");
const path = require("path");
exports.uploadjobdesc = async (req, res) => {
  try {
    

    const { JobTitle, ClientName, Location, SalaryRange, JobDescription,openingPositions,priority,companyId  } = req.body;
    
    const jdTextForEmbedding = `
  Job Title: ${JobTitle || ""}
  Client Name: ${ClientName || ""}
  Location: ${Location || ""}
  Salary Range: ${SalaryRange || ""}
  Description: ${JobDescription || ""}
`;

   
    if (!JobTitle || !ClientName ||!companyId) {
      
      return res.status(400).json({ error: "JobTitle and ClientName are required" });
    }
    if (!priority){
      priority="Low"
    }

    
    const existingJD = await db
      .collection("job_descriptions")
      .where("JobTitle", "==", JobTitle)
      .where("ClientName", "==", ClientName)
      .where("companyId","==",companyId)
      .get();

    
    if (!existingJD.empty) {
    
      return res.status(409).json({ message: "Job description already exists" });
    }
    //check for render service is live or not after uncomment it
    const embedding = await getEmbedding(jdTextForEmbedding);

    
    const ref = await db.collection("job_descriptions").add({
      JobTitle,
      ClientName,
      Location,
      SalaryRange,
      JobDescription,
      embedding,
      openingPositions,
      priority,
      companyId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    
    res.json({ message: "Job description added successfully", id: ref.id });
  } catch (error) {
    console.error("❌ Error uploading job description:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


exports.getjobdesc = async (req, res) => {
  try {
    const{companyId}=req.body
    
    const snapshot = await db.collection("job_descriptions").where("companyId","==",companyId).get()

    if (snapshot.empty) {
      return res.status(404).json({ message: "No job descriptions found" });
    }

    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // This will now show actual job data
    res.json(jobs);

  } catch (error) {
    console.error("Error fetching job descriptions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


exports.uploadJDFromFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const fileBuffer = req.file.buffer; // from memoryStorage
    const companyId=req.body.companyId
    let text = "";
    if (ext === ".pdf") {
      text = await extractTextFromPDF(fileBuffer);
    } else if (ext === ".docx") {
      text = await extractTextFromDocx(fileBuffer);
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const { JobTitle, ClientName, Location, SalaryRange, JobDescription } =
      await extractJDMetadataFromText(text);
     

    if (!JobTitle || !ClientName) {
      return res.status(400).json({
        error: "Could not extract required fields: JobTitle and ClientName"
      });
    }

    const existingJD = await db
      .collection("job_descriptions")
      .where("JobTitle", "==", JobTitle)
      .where("ClientName", "==", ClientName)
      .where("companyId","==",companyId)
      .get();

    if (!existingJD.empty) {
      return res.status(409).json({ message: "Job description already exists" });
    }
    //check for render service is live or not after uncomment it
    const embedding = await getEmbedding(text); 
    const ref = await db.collection("job_descriptions").add({
      JobTitle,
      ClientName,
      Location: Location || "",
      SalaryRange: SalaryRange || "",
      JobDescription: JobDescription || "",
      companyId:companyId,
      embedding:embedding,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Job description added successfully", id: ref.id });
  } catch (error) {
    console.error("❌ Error uploading JD from file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateJobById = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { openingPositions, status,priority } = req.body;
    
    if (openingPositions == null || status == null) {
      return res.status(400).json({ message: "Missing fields to update" });
    }

    const jobRef = db.collection("job_descriptions").doc(jobId);

    const doc = await jobRef.get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Job not found" });
    }

    await jobRef.update({
      openingPositions: Number(openingPositions),
      status,
      priority,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: "Job updated successfully" });
  } catch (error) {
    console.error("Error updating job:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
exports.deletejd=async(req,res)=>{
  try {
    const jdid=req.params.id
  const jobRef=await db.collection("job_descriptions").doc(jdid)
  const doc = await jobRef.get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Job not found" });
    }
  await jobRef.delete()
    return res.status(200).json({ message: "Job updated successfully" });
  } catch (error) {
    console.error("Error updating job:", error);
    return res.status(500).json({ message: "Internal server error" });
  }

} 