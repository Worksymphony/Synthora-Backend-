const { bucket, admin } = require("../config/firebase");
const path = require("path");
const { extractTextFromPDF, extractTextFromDocx, extractMetadataFromText,extractTextFromDoc } = require("../utils/extractmetadata");
const {getEmbedding}=require("../utils/getembedding")
const db = admin.firestore();

exports.uploadToFirebase = async (req, res) => {
  try {
    const files = req.files;
    const recruiterId = req.body.recuiter;   // recruiter id (optional)
    const companyId = req.body.companyId;
    const companyname=req.body.companyname; // company name / id

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded." });
    }

    const uploadResults = [];

    for (const file of files) {
      try {
        const ext = path.extname(file.originalname).toLowerCase();
        let text = "";

        if (ext === ".pdf") {
          text = await extractTextFromPDF(file.buffer);
        } else if (ext === ".docx") {
          text = await extractTextFromDocx(file.buffer);
        } else if (ext === ".doc") {
          text = await extractTextFromDoc(file.buffer);
        } else {
          continue;
        }

        if (!text || text.trim().length < 50) continue;

        const metadata = await extractMetadataFromText(text);
        if (!metadata.email) continue;

        // 🔍 check if resume already exists
        const querySnapshot = await db
          .collection("resumes")
          .where("email", "==", metadata.email)
          .get();

        const filePath = `resumes/${metadata.email}${ext}`;
        const blob = bucket.file(filePath);

        const blobStream = blob.createWriteStream({
          metadata: { contentType: file.mimetype },
        });

        await new Promise((resolve, reject) => {
          blobStream.on("error", reject);
          blobStream.on("finish", resolve);
          blobStream.end(file.buffer);
        });

        await blob.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

        const embedding = await getEmbedding(text);

        const resumeData = {
          ...metadata,
          embedding,
          fileURL: publicUrl,
          fileName: file.originalname,
          uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        let resumeDocId;
        if (!querySnapshot.empty) {
          resumeDocId = querySnapshot.docs[0].id;
          await db.collection("resumes").doc(resumeDocId).set(resumeData);
        } else {
          const docRef = await db.collection("resumes").add(resumeData);
          resumeDocId = docRef.id;
        }

        // ✅ If uploaded by recruiter → add assignment mapping
        if (recruiterId && companyname) {
          const assignRef = db
            .collection("resumeAssignments")
            .doc(`${resumeDocId}_${companyname}`);

          const existingAssign = await assignRef.get();
          if (!existingAssign.exists) {
            await assignRef.set({
              resumeId: resumeDocId,
              companyId,
              companyname,
              recruiterId,
              locked: true,
              taggedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        uploadResults.push({ name: file.originalname, url: publicUrl });
      } catch (innerError) {
        console.error(`Error processing file ${file.originalname}:`, innerError);
        continue;
      }
    }

    res.status(200).json({
      message: "Processing completed.",
      uploaded: uploadResults,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Error uploading files", error: error.message });
  }
};


exports.updatehiringstatus=async(req,res)=>{
  try {
    const candId=req.params.id
    const status=req.body
    
    const CandRef=await db.collection("resumes").doc(candId)
    const candSnap = await CandRef.get();
    const oldData = candSnap.data();
    const oldStatus = oldData.hiringstatus;

    if (!candSnap.exists) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    CandRef.update({
      hiringstatus:status.hiringstatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    //stepup mail first then uncomment it 
    //  if (oldStatus !== status.hiringstatus) {
    //   await sendCandidateEmail(
    //     oldData.email, // assuming resumes doc has `email`
    //     hiringstatus,
    //     oldData.name   // assuming resumes doc has `name`
    //   );
    // }
    return res.status(200).json({ message: "Candidate hiring process updated successfully" });
  } catch (error) {
    console.error("Error updating job:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
