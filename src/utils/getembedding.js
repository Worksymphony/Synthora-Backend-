let extractor;

async function loadPipeline() {
  if (!extractor) {
    const { pipeline } = await import("@xenova/transformers");
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
}

async function getEmbedding(text) {
  const extractor = await loadPipeline();
  console.log("embedding called")
  const output = await extractor(text, { pooling: "mean", normalize: true });
  
  return Array.from(output.data);
}

module.exports = { getEmbedding };
