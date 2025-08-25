const axios=require("axios")


exports.getaians=async(req,res)=>{
   const message= req.body.question
    try {
       if (process.env.GEMINI_API_KEY) {
         console.log("Trying Gemini...");
         const geminiRes = await axios.post(
           `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
           { contents: [{ parts: [{ text: message }] }] }
         );
         console.log(geminiRes)
         const geminiText = geminiRes.data.candidates[0].content.parts[0].text;
         let responseData;
            try {
            // Try to parse JSON if Gemini sent structured data
            responseData = JSON.parse(geminiText.replace(/```json|```/gi, "").trim());
            } catch {
            // Fallback: plain text
            responseData = { answer: geminiText };
            }
         
         
         
         res.json(responseData)
       } else {
         console.warn("Skipping Gemini — no API key found");
       }
     } catch (err) {
       console.error("Gemini failed:", err.message);
     }
}