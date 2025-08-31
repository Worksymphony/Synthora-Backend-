
const { bucket, admin } = require("../config/firebase");
const { getResumeScore } = require("../utils/aiscoring");
const db = admin.firestore();
const {extractTextFromPDF} =require("../utils/extractmetadata")
async function getResumeTexts(top20) {
  return await Promise.all(
    top20.map(async (resume) => {
      try {
        // Download the PDF from fileURL
        const res = await fetch(resume.fileURL);
        if (!res.ok) {
          throw new Error(`Failed to fetch ${resume.fileURL} - ${res.status}`);
        }

        const buffer = Buffer.from(await res.arrayBuffer());

        // Extract text
        const text = await extractTextFromPDF(buffer);

        return {
          id: resume.id,
          text: text.trim()
        };
      } catch (err) {
        console.error(`Error processing resume ${resume.id}:`, err.message);
        return {
          id: resume.id,
          text: ""
        };
      }
    })
  );
}

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
  const magB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
  return dot / (magA * magB);
}
exports.matchingcontroller = async (req, res) => { try {
 // Extract required data from the request body
const { uid, userid, companyId } = req.body;


 if (!uid || !userid || !companyId) {
 return res.status(400).json({ error: "Missing required parameters" });
  }

  // Start Firestore Transaction
  const aiUsageTransaction = await db.runTransaction(async (transaction) => {
   const userRef = db.collection("users").doc(userid);
   const companyRef = db.collection("companys").doc(companyId);
   const jdRef = db.collection("job_descriptions").doc(uid);

   // Read documents within the transaction
   const userSnap = await transaction.get(userRef);
   const companySnap = await transaction.get(companyRef);
   const jdSnap = await transaction.get(jdRef);

   if (!userSnap.exists || !companySnap.exists || !jdSnap.exists) {
    throw new Error("User, Company, or JD not found");
   }

   const userData = userSnap.data();
   const companyData = companySnap.data();

   const currentCompanyUsage = companyData.currentusage || 0;
   const companyLimit = companyData.ailimit || 0;

   // Check the AI limit
   if (currentCompanyUsage >= companyLimit) {
   return {
    status: "limit_exceeded",
    data: null,
    warning:null,
   };
   }

   const jdEmd = jdSnap.data().embedding;
   const jdText = Object.entries(jdSnap.data())
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");




// check of not interested and rejected candidates
   const resumesSnap = await db.collection("resumes").get();
   let resumes = resumesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
   }));
     const alreadyProcessed = jdSnap.data().neglectedResumes || [];
        
      

      resumes = resumes.filter(r => !alreadyProcessed.includes(r.id));



   // Step 1: Compute cosine similarity
   const scoredResumes = resumes.map(resume => ({
    ...resume,
    score: cosineSimilarity(jdEmd, resume.embedding),
   }));

   // ... (existing code for filtering, sorting) ...
   const scores = scoredResumes.map(r => r.score);
const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
const stdDev = Math.sqrt(variance);

const threshold = mean + 0.5 * stdDev; 
   const filteredResumes = scoredResumes.filter(resume => resume.score >= threshold);
   const topResumes = filteredResumes.sort((a, b) => b.score - a.score);
   const shortlistedResumes = topResumes.slice(0, 3);
   // Step 5: Get resume texts for AI scoring
 
   const resumeTexts = await getResumeTexts(shortlistedResumes);

   const AIscoring = await Promise.all(
    resumeTexts.map(async resume => {
     const  score  = await getResumeScore(jdText, resume.text);
     return {
      id: resume.id,
      score
      
     };
    })
   );

   // Calculate total tokens used for this single operation
   const totalTokensForThisMatch = AIscoring.reduce((acc, current) => acc + current.score.usage, 0);
   const sortedAIscoring = AIscoring.sort((a, b) => b.score.parsed.score - a.score.parsed.score);

  const newCompanyUsage = currentCompanyUsage + totalTokensForThisMatch;
   // Check limit again before writing (just in case of parallel requests)
   let warning = null;
if (newCompanyUsage > companyLimit) {
  warning = "Company usage has exceeded the AI token limit. Further requests will be blocked.";
}

   // Update the usage fields within the transaction
   
   const newUserUsage = (userData.usage || 0) + totalTokensForThisMatch;

   transaction.update(companyRef, { currentusage: newCompanyUsage });
   transaction.update(userRef, { usage: newUserUsage });

   // Return data to be sent as the API response
   return {
    status: "success",
    data: sortedAIscoring,
    warning
   };
  }); // End of transaction

  
  if (aiUsageTransaction.status==="limit_exceeded"){res.status(200).json({
    status: "limit_exceeded",
    message: "Company AI token limit exceeded."
    
  })}
  else{
    res.status(200).json({ message: "Received successfully", data: aiUsageTransaction.data,warning:aiUsageTransaction.warning });
  }
  
  
 } catch (error) {
  console.error(error);
  res.status(500).json({ error: "Internal Server Error" });
 }
};














exports.matchingcontrollerRecent = async (req, res) => { try {
 // Extract required data from the request body
const { uid, userid, companyId } = req.body;


 if (!uid || !userid || !companyId) {
 return res.status(400).json({ error: "Missing required parameters" });
  }

  // Start Firestore Transaction
  const aiUsageTransaction = await db.runTransaction(async (transaction) => {
   const userRef = db.collection("users").doc(userid);
   const companyRef = db.collection("companys").doc(companyId);
   const jdRef = db.collection("job_descriptions").doc(uid);

   // Read documents within the transaction
   const userSnap = await transaction.get(userRef);
   const companySnap = await transaction.get(companyRef);
   const jdSnap = await transaction.get(jdRef);

   if (!userSnap.exists || !companySnap.exists || !jdSnap.exists) {
    throw new Error("User, Company, or JD not found");
   }

   const userData = userSnap.data();
   const companyData = companySnap.data();

   const currentCompanyUsage = companyData.currentusage || 0;
   const companyLimit = companyData.ailimit || 0;

   // Check the AI limit
   if (currentCompanyUsage >= companyLimit) {
   return {
    status: "limit_exceeded",
    data: null,
    warning:null,
   };;
   }

   const jdEmd = jdSnap.data().embedding;
   const jdText = Object.entries(jdSnap.data())
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");




// check of recent candidate
    const oneHourAgo = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - 60 * 60 * 1000)
        );

    const tagsSnap = await db
  .collection("resumeAssignments").where("recruiterId","==",userid)
  .where("companyId", "==", companyId)   // Only this company's uploads
  .where("taggedAt", ">", oneHourAgo)    // Only recent uploads
  .get(); 
  
  const taggedResumeIds = tagsSnap.docs.map(doc => doc.data().resumeId);

  if (taggedResumeIds.length===0){
    return {
    status: "Not Found",
    data: null,
    warning:null,
   };
  }
    const resumesSnap = await db
        .collection("resumes")
        .where(admin.firestore.FieldPath.documentId(), "in", taggedResumeIds)
        .get();


   let resumes = resumesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
   }));
   
   
     const alreadyProcessed = jdSnap.data().neglectedResumes|| [];
        
      

      resumes = resumes.filter(r => !alreadyProcessed.includes(r.id));



   // Step 1: Compute cosine similarity
   const scoredResumes = resumes.map(resume => ({
    ...resume,
    score: cosineSimilarity(jdEmd, resume.embedding),
   }));

   // ... (existing code for filtering, sorting) ...
   const scores = scoredResumes.map(r => r.score);
const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
const stdDev = Math.sqrt(variance);

const threshold = 0.2
   const filteredResumes = scoredResumes.filter(resume => resume.score >= threshold);
   const topResumes = filteredResumes.sort((a, b) => b.score - a.score);
   const shortlistedResumes = topResumes.slice(0, 3);
   // Step 5: Get resume texts for AI scoring
 
   const resumeTexts = await getResumeTexts(shortlistedResumes);

   const AIscoring = await Promise.all(
    resumeTexts.map(async resume => {
     const  score  = await getResumeScore(jdText, resume.text);
     return {
      id: resume.id,
      score
      
     };
    })
   );

   // Calculate total tokens used for this single operation
   const totalTokensForThisMatch = AIscoring.reduce((acc, current) => acc + current.score.usage, 0);
  const newCompanyUsage = currentCompanyUsage + totalTokensForThisMatch;
   // Check limit again before writing (just in case of parallel requests)
   let warning = null;
if (newCompanyUsage > companyLimit) {
  warning = "Company usage has exceeded the AI token limit. Further requests will be blocked.";
}

   // Update the usage fields within the transaction
   
   const newUserUsage = (userData.usage || 0) + totalTokensForThisMatch;

   transaction.update(companyRef, { currentusage: newCompanyUsage });
   transaction.update(userRef, { usage: newUserUsage });

   // Return data to be sent as the API response
   return {
    status: "success",
    data: AIscoring,
    warning
   };
  }); // End of transaction

if (aiUsageTransaction.status==="limit_exceeded"){res.status(200).json({
    status: "limit_exceeded",
    message: "Company AI token limit exceeded."
    
  })}
 else if(aiUsageTransaction.status==="Not Found"){
  res.status(200).json({
    status: "Not Found",
    message: "No Recent Candidate",
    
  })
 } 
  else{
    res.status(200).json({ message: "Received successfully", data: aiUsageTransaction.data,warning:aiUsageTransaction.warning });
  }
 } catch (error) {
  console.error(error);
  res.status(500).json({ error: "Internal Server Error" });
 }
};

