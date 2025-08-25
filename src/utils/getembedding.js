async function getEmbedding(text) {
  const response = await fetch("https://embedding-model-87ae.onrender.com/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.vector; // store this in Firestore
}

module.exports = { getEmbedding };