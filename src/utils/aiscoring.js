const axios = require("axios");

function safeJSONParse(text) {
  try {
    const cleaned = text
      ?.replace(/```json|```/gi, '') // remove code fences
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("JSON parse failed:", err.message, "\nRaw:", text);
    return null;
  }
}

async function getResumeScore(jdText, resumeText) {
  const prompt = `
You are an expert recruiter. Compare the following Job Description (JD) with the provided Resume. 
Be very honest — if the resume doesn't match, score low (even 0). And remember strengths and weaknesses and the matching reasoning should be small kindly 3-4 lines
and remember in JD thier are additinal points field if its empty dont consider it and if it contain points kindlly use that point for reasoning purpose eg(if it has gender male and in reasoning for female candidate should be Jd require male but this is female)
Return only valid JSON in this format:
{
  "score": 0-100,
  "strengths": [],
  "weaknesses": [],
  "match_reasoning": ""
}

JD:
${jdText}

Resume:
${resumeText}
`;

  // 1️⃣ Try Gemini first
  try {
    if (process.env.GEMINI_API_KEY) {
      console.log("Trying Gemini...");
      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );
      const geminiText = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
      const usage=geminiRes.data.usageMetadata.totalTokenCount
      const parsed = safeJSONParse(geminiText);
      console.log("Done scoring")
      if (parsed) return {parsed,usage};
    } else {
      console.warn("Skipping Gemini — no API key found");
    }
  } catch (err) {
    console.error("Gemini failed:", err.message);
  }

  // 2️⃣ Fallback to GPT-4o-mini
  try {
    if (process.env.OPENAI_API_KEY) {
      console.log("Trying GPT-4o-mini...");
      const gptRes = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
        },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
      );
      const gptText = gptRes.data.choices?.[0]?.message?.content;
      
      const usage=gptRes.data.usage.total_tokens;
      const parsed = safeJSONParse(gptText);
      if (parsed) return {parsed,usage};
    } else {
      console.warn("Skipping GPT — no API key found");
    }
  } catch (err) {
    console.error("GPT-4o-mini failed:", err.message);
  }

  // 3️⃣ Fallback to DeepSeek
  // try {
  //   if (process.env.DEEPSEEK_API_KEY) {
  //     console.log("Trying DeepSeek...");
  //     const deepseekRes = await axios.post(
  //       "https://api.deepseek.com/chat/completions",
  //       {
  //         model: "deepseek-chat",
  //         messages: [{ role: "user", content: prompt }],
  //       },
  //       { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } }
  //     );
  //     const deepseekText = deepseekRes.data.choices?.[0]?.message?.content;
  //     const parsed = safeJSONParse(deepseekText);
  //     if (parsed) return parsed;
  //   } else {
  //     console.warn("Skipping DeepSeek — no API key found");
  //   }
  // } catch (err) {
  //   if (err.response?.status === 402) {
  //     console.warn("DeepSeek requires payment — skipping");
  //   } else {
  //     console.error("DeepSeek failed:", err.message);
  //   }
  // }

  // 4️⃣ If all failed
  console.error("All models failed to return a valid score");
  return null;
}

module.exports = { getResumeScore };
