const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const nlp = require("compromise");
const textract =require("textract");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractFirstMatch(regex, text) {
  if (!text) return "";
  const match = text.match(regex);
  return match && match[1] ? match[1].trim() : "";
}

async function extractTextFromPDF(buffer) {
  const data = await pdfParse(buffer);
  console.log("✅ PDF text extracted:", data.text.slice(0, 300), "..."); // first 300 chars
  return data.text || "";
}

async function extractTextFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  console.log("✅ DOCX text extracted:", result.value.slice(0, 300), "...");
  return result.value || "";
}
async function extractTextFromDoc(buffer) {
  return new Promise((resolve, reject) => {
    textract.fromBufferWithMime("application/msword", buffer, (err, text) => {
      if (err) {
        console.error("❌ Error extracting DOC text:", err);
        return reject(err);
      }
      console.log("✅ DOC text extracted:", text?.slice(0, 300), "...");
      resolve(text || "");
    });
  });
}
function extractPhone(text) {
  const phones = text.match(/(\+?\d{1,3}[-.\s]?)?(\(?\d{3,4}\)?[-.\s]?){1,2}\d{3,4}/g);
  if (!phones || phones.length === 0) return "";
  return phones.reduce((a, b) => (a.length > b.length ? a : b)).trim();
}

function fallbackExtractMetadataFromText(text) {
  text = text || "";
  const doc = nlp(text);

  const name = doc.people().out("array")[0] || extractFirstMatch(/(?:Name|Candidate)\s*[:\-]?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/, text);

  let email = extractFirstMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i, text);
  if (!email) {
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/gi);
    email = emails && emails.length ? emails[0].replace(/\s+/g, "") : "";
  }

  const phone = extractPhone(text);
  const location = doc.places().out("array")[0] || extractFirstMatch(/(?:Location|City)\s*[:\-]?\s*([\w\s,]+)/i, text);

  const roleTitles = [
    "Manager","Developer","Engineer","Analyst","Consultant",
    "Executive","Designer","Lead","Architect","Scientist","Specialist"
  ];
  const roleRegex = new RegExp(`\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,3})\\s+(${roleTitles.join("|")})\\b`);
  const role = extractFirstMatch(roleRegex, text);
  const skills = extractFirstMatch(/(?:Skills?|Technologies)\s*[:\-]?\s*(.+?)(?:\n|$)/i, text);
  const sector = extractFirstMatch(/(?:Sector|Industry)\s*[:\-]?\s*(.+?)(?:\n|$)/i, text);

  console.log("🔹 Fallback metadata:", { name, email, phone, role, skills, location, sector });
  return { name, email, phone, role, skills, location, sector };
}

function cleanAIJson(responseText) {
  if (!responseText) return "{}";
  return responseText.replace(/```json|```/g, "").trim();
}

async function extractMetadataFromText(text) {
  console.log("📝 Original text length:", text.length);

  const prompt = `
Extract the following from this resume text in pure JSON:
{
  "name": "",
  "email": "",
  "phone": "",
  "role": "",
  "Gender":"",
  "skills": [],
  "location": "",
  "sector": ""
}
Text:
${text}

Return ONLY the JSON object, no explanations, no markdown.and name Should be in small letters  and skills should be array and sector should be one work and location should be city only and both sector and location should be lowercase and correctly determine Gender Male or Female
`;

  // 1️⃣ Gemini
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const cleaned = cleanAIJson(result.response.text());
    console.log("🤖 Gemini output:", cleaned);
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("⚠ Gemini failed:", err.message);
  }

  // 2️⃣ GPT
  try {
    const gptRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });
    const cleaned = cleanAIJson(gptRes.choices[0].message.content);
    console.log("🤖 GPT output:", cleaned);
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("⚠ GPT failed:", err.message);
  }

  // 3️⃣ Fallback
  console.log("ℹ Using fallback regex parser");
  return fallbackExtractMetadataFromText(text);
}

// Job details extraction
function extractJobDetailsFromText(text) {
  const doc = nlp(text);
  const jobTitle = extractFirstMatch(/(?:Job\s*Title|Position|Role)\s*[:\-]?\s*(.+)/i, text) || doc.match("#TitleCase+ (Developer|Engineer|Manager|Analyst|Architect|Designer|Consultant)").out("text");
  const clientName = extractFirstMatch(/(?:Client|Company|Organisation|Organization)\s*[:\-]?\s*(.+)/i, text);
  const location = extractFirstMatch(/(?:Location|City|Place)\s*[:\-]?\s*([A-Za-z\s,]+)/i, text) || doc.places().out("text");
  const salaryRange = extractFirstMatch(/(?:Salary|Compensation|Pay)\s*[:\-]?\s*(\₹?\$?\d[\d,]*(?:\s*-\s*\₹?\$?\d[\d,]*)?)/i, text);
  const jobDescription = extractFirstMatch(/(?:Job\s*Description|Responsibilities|Role\s*Description)\s*[:\-]?\s*([\s\S]+)/i, text);

  console.log("🔹 Job details:", { jobTitle, clientName, location, salaryRange });
  return {
    JobTitle: jobTitle ? jobTitle.trim() : null,
    ClientName: clientName ? clientName.trim() : null,
    Location: location ? location.trim() : null,
    SalaryRange: salaryRange ? salaryRange.trim() : null,
    JobDescription: jobDescription ? jobDescription.trim() : text.trim(),
  };
}

async function extractJDMetadataFromText(text) {
  console.log("📝 JD text length:", text.length);

  const prompt = `
You are an information extraction system. 
From the given job description text, extract ONLY the following fields in pure JSON:

{
  "JobTitle": "",        // clear job title (e.g., "Software Engineer"). If not found, put No Job title .
  "ClientName": "",      // company/client name (short and clean). If not found, put No Client Name.
  "Location": "",        // city only, in lowercase. If multiple locations, pick the first city mentioned. If not found, put No Location.
  "SalaryRange": "",     // numeric or text salary info (e.g., "8-12 LPA", "$80k-$100k/year"). If not found, put No SalaryRange.
  "JobDescription": ""   // concise summary (4–5 sentences max) of the responsibilities/requirements. If not found, put No JobDescription.
}

Text:
${text}

Rules:
- Return ONLY the JSON object. No markdown, no explanations, no extra text.
- Do not invent information that isn’t in the text.
- Keep formatting clean and consistent.
-remember if the cliet name is TMIBASL then make it Tata Motors Insurance Broking &Advisory Services Limited.
`;

  // 1️⃣ Gemini
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const cleaned = cleanAIJson(result.response.text());
    console.log("🤖 Gemini JD output:", cleaned);
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("⚠ Gemini JD failed:", err.message);
  }

  // 2️⃣ GPT
  try {
    const gptRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });
    const cleaned = cleanAIJson(gptRes.choices[0].message.content);
    console.log("🤖 GPT JD output:", cleaned);
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("⚠ GPT JD failed:", err.message);
  }

  // 3️⃣ Fallback parser
  console.log("ℹ Using fallback JD regex parser");
  const doc = nlp(text);

  const jobTitle = extractFirstMatch(/(?:Job\s*Title|Position|Role)\s*[:\-]?\s*(.+)/i, text) 
                  || doc.match("#TitleCase+ (Developer|Engineer|Manager|Analyst|Architect|Designer|Consultant)").out("text");

  const clientName = extractFirstMatch(/(?:Client|Company|Organisation|Organization)\s*[:\-]?\s*(.+)/i, text);
  const location = extractFirstMatch(/(?:Location|City|Place)\s*[:\-]?\s*([A-Za-z\s,]+)/i, text) || doc.places().out("text");
  const salaryRange = extractFirstMatch(/(?:Salary|Compensation|Pay)\s*[:\-]?\s*(\₹?\$?\d[\d,]*(?:\s*-\s*\₹?\$?\d[\d,]*)?)/i, text);

  return {
    JobTitle: jobTitle ? jobTitle.trim() : null,
    ClientName: clientName ? clientName.trim() : null,
    Location: location ? location.trim() : null,
    SalaryRange: salaryRange ? salaryRange.trim() : null,
    JobDescription: text.trim(),
  };
}

module.exports = {
  extractTextFromPDF,
  extractTextFromDocx,
  extractMetadataFromText,
  extractJobDetailsFromText,
  extractJDMetadataFromText,
  extractTextFromDoc,
};
