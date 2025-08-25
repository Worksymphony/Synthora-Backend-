async function rerankResumes(query, documents) {
  const response = await fetch("https://cross-ranking-model.onrender.com/rerank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,       // JD text
      documents    // array of resumes
    }),
  });

  if (!response.ok) {
    throw new Error(`Reranking API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results || data; // handle both {results:[]} and [] response
}

module.exports = { rerankResumes };
