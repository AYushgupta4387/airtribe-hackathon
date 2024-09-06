const fs = require("fs");
const openAI = require("openai");
const { Pinecone } = require("@pinecone-database/pinecone");
const express = require("express");
const cors = require("cors"); // Import the cors package

const dotenv = require("dotenv");
dotenv.config();

const app = express();
const port = 5000;
const openAIKey = process.env.openAIKey;
const pineconeKey = process.env.pineconeAPIKey;

const openai = new openAI({
  apiKey: openAIKey,
});

const pinecone = new Pinecone({
  apiKey: pineconeKey,
});

const pineconeIndexName = "redux-data";
const pineConeNameSpace = "redux";

// Middleware to enable CORS
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

app.post("/get/response", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      throw new Error("Question is required");
    }

    const index = await pinecone
      .index(pineconeIndexName)
      .namespace(pineConeNameSpace);

    // const embeddings = await createEmbeddingForChunks();
    // await uploadEmbeddings(embeddings, index);

    const questionEmbedding = await createOpenAIEmbeddings(question);
    const similarVectors = await findSimilar(
      index,
      questionEmbedding.data[0].embedding
    );

    if (!similarVectors || similarVectors.matches.length === 0) {
      throw new Error("No similar vectors found");
    }

    const gptResponse = await createOpenAIResponse(
      question,
      similarVectors.matches[0].metadata.text
    );

    res.json({
      question: question,
      response: gptResponse,
    });
  } catch (error) {
    console.error("Error:", error.message || error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

const readText = async () => {
  let text = fs.readFileSync("./redux-data.txt", "utf8");
  return text;
};

const createChunk = async () => {
  const CHUNK_SIZE = 50;
  const reduxText = await readText();
  const lines = reduxText.split("\n").filter((line) => line.length > 0);
  const chunks = []; // array of chunks of 6 lines

  for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
    const chunk = lines.slice(i, i + CHUNK_SIZE);
    chunks.push(chunk.join("\n"));
  }

  return chunks;
};

const createOpenAIEmbeddings = async (chunk) => {
  const embeddings = await openai.embeddings.create({
    input: chunk,
    model: "text-embedding-3-small",
    dimensions: 1024,
  });
  return embeddings;
};

const createEmbeddingForChunks = async () => {
  const chunks = await createChunk();
  const embeddings = []; // array of objects, each object has the chunk and its embedding

  for (const chunk of chunks) {
    const embedding = await createOpenAIEmbeddings(chunk);
    embeddings.push({
      chunk,
      embedding,
    });
  }

  return embeddings;
};

const uploadEmbeddings = async (embeddings, index) => {
  const embeddingsToUpload = [];
  for (let i = 0; i < embeddings.length; i += 1) {
    const embedding = embeddings[i];
    console.log(embedding);

    embeddingsToUpload.push({
      id: `vec_${i}`,
      values: embedding.embedding.data[0].embedding,
      metadata: {
        text: embedding.chunk,
      },
    });
  }
  console.log(embeddingsToUpload);
  await index.upsert(embeddingsToUpload);
};

const findSimilar = async (index, vector) => {
  const requestQuery = {
    vector,
    topK: 1,
    includeValues: false,
    includeMetadata: true,
  };

  const response = await index.query(requestQuery);
  return response;
};

const createOpenAIResponse = async (question, context) => {
  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Based on the provided context here give the answer to the question \n ${context}`,
        },
        { role: "user", content: question },
      ],
      model: "gpt-3.5-turbo",
    });
    return chatCompletion.choices[0].message.content; // Ensure you're accessing the correct part of the response
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error; // Re-throw the error to be caught in the main handler
  }
};

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
