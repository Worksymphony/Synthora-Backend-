const { bucket, admin } = require("../config/firebase");
const path = require("path");
const { extractTextFromPDF, extractTextFromDocx, extractMetadataFromText,extractTextFromDoc } = require("../utils/extractmetadata");
const {getEmbedding}=require("../utils/getembedding")
const db = admin.firestore();

exports.uploadToFirebase = async (req, res) => {
  try {
    const files = req.files;
    const recruiterId = req.body.recruiterId;
    const recruitername = req.body.recruitername;
    const companyId = req.body.companyId;
    const companyname = req.body.companyname;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded." });
    }

    const uploadResults = [];
    const failedResults = []; // 👈 track failures

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
          failedResults.push({
            name: file.originalname,
            reason: `Unsupported file type: ${ext}`,
          });
          continue;
        }

        if (!text || text.trim().length < 50) {
          failedResults.push({
            name: file.originalname,
            reason: "Text extraction failed or file too short",
          });
          continue;
        }

        const metadata = await extractMetadataFromText(text);
        if (!metadata.email) {
          failedResults.push({
            name: file.originalname,
            reason: "Could not detect email in resume",
          });
          continue;
        }

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

        // ✅ recruiter assignment
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
              recruitername,
              recruiterId,
              locked: true,
              taggedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        uploadResults.push({ name: file.originalname, url: publicUrl });
      } catch (innerError) {
        console.error(`Error processing file ${file.originalname}:`, innerError);
        failedResults.push({
          name: file.originalname,
          reason: innerError.message || "Unknown error",
        });
      }
    }

    res.status(200).json({
      message: "Processing completed.",
      uploaded: uploadResults,
      failed: failedResults, 
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      message: "Error uploading files",
      error: error.message,
    });
  }
};



exports.updateHiringStatus = async (req, res) => {
  try {
    const candId = req.params.id; // resumeId
    const { hiringstatus, companyId } = req.body;
    
    // Find the assignment for this resume + company
    const assignmentQuery = await db
      .collection("resumeAssignments")
      .where("resumeId", "==", candId)
      .where("companyId", "==", companyId)
      .limit(1)
      .get();

    if (assignmentQuery.empty) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const assignmentDoc = assignmentQuery.docs[0].ref;

    // Update hiring status only for this company's assignment
    await assignmentDoc.update({
      hiringstatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: "Hiring status updated successfully" });
  } catch (error) {
    console.error("Error updating hiring status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

