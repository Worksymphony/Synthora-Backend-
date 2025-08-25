const fetch = require("node-fetch"); // or native fetch in newer Node versions
const {  admin } = require("../config/firebase");
const db = admin.firestore();

const OPENROUTER_API_KEY ="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"; // Set in your env vars

exports.generateAiReport = async (req, res) => {
  try {
    // 1. Fetch relevant data from Firestore (example: all hired candidates last week)
    const resumesSnapshot = await db
      .collection("resumes").get();

    if (resumesSnapshot.empty) {
      return res.status(404).json({ error: "No hired candidates found." });
    }

    // 2. Build a simple summary prompt string from fetched data
    let prompt = "Generate a detailed AI hiring report based on these candidates:\n\n";
   let resumedata=[]
    resumesSnapshot.forEach((doc) => {
      resumedata.push({
        id:doc.id,
        ...doc.data()
      })
    });
    
    prompt+=`${JSON.stringify(resumedata, null, 2)},this is the data`

    prompt += "\nProvide insights, trends, and recommendations based on the above data.";

    // 3. Call openrouter.ai GPT-OSS-20B API with this prompt
    const apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      throw new Error(`OpenRouter API error: ${apiRes.status} ${errorText}`);
    }

    const apiJson = await apiRes.json();
    const aiReport = apiJson.choices?.[0]?.message?.content || "No AI report generated";

    // 4. Send AI report back to frontend
    res.json({ report: aiReport });
  } catch (error) {
    console.error("Error generating AI report:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI report" });
  }
};
