import { PrepSession } from "../models/PrepSession.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY,
});

// GET /api/prep/:applicationId
// get prep session for an application
export const getPrepSession = async (req, res) => {
  try {
    const session = await PrepSession.findOne({
      applicationId: req.params.applicationId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({
        message:
          "No prep session found for this application. Run the analysis pipeline first.",
      });
    }

    return res.status(200).json({ success: true, session });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/prep/:applicationId/answer
// user submits answer to a question — AI scores it
export const submitAnswer = async (req, res) => {
  const { questionIndex, userAnswer } = req.body;

  if (questionIndex === undefined || !userAnswer?.trim()) {
    return res.status(400).json({
      message: "questionIndex and userAnswer are required",
    });
  }

  try {
    const session = await PrepSession.findOne({
      applicationId: req.params.applicationId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({ message: "Prep session not found" });
    }

    if (
      !Number.isInteger(questionIndex) ||
      questionIndex < 0 ||
      questionIndex >= session.questions.length
    ) {
      return res.status(400).json({
        message: "Invalid question index",
      });
    }

    const question = session.questions[questionIndex];
    // score the answer against model answer
    const scorePrompt = `You are evaluating a candidate's interview answer.

Question: ${question.q}

Model Answer: ${question.a}

Candidate's Answer: ${userAnswer}

Evaluate the candidate's answer on these criteria:
1. Relevance — does it actually answer the question?
2. Depth — is there enough technical/contextual detail?
3. Structure — is it clear and organized?
4. Completeness — are key points covered?

Return ONLY a JSON object:
{
  "score": <number between 0 and 1>,
  "feedback": "<2-3 sentences — what was good and what to improve>"
}`;

    const response = await llm.invoke(scorePrompt);

    const rawContent = Array.isArray(response.content)
      ? response.content.map((p) => p.text || "").join("")
      : (response.content ?? "");

    let raw = String(rawContent).trim();

    if (raw.startsWith("```")) {
      raw = raw
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
    }

    const objectStart = raw.indexOf("{");
    const objectEnd = raw.lastIndexOf("}");

    let parsed;

    try {
      if (objectStart === -1 || objectEnd === -1) {
        throw new Error("No JSON object found");
      }

      parsed = JSON.parse(raw.slice(objectStart, objectEnd + 1));
    } catch (err) {
      console.warn("[prep] Invalid JSON returned by AI:", err.message);

      parsed = {
        score: 0.5,
        feedback: "Unable to evaluate answer.",
      };
    }

    // Always normalize the score
    parsed.score = Math.max(0, Math.min(1, Number(parsed.score) || 0));
    // update the specific question
    session.questions[questionIndex].userAnswer = userAnswer;
    session.questions[questionIndex].score = parsed.score;
    session.questions[questionIndex].feedback = parsed.feedback || "";
    session.markModified("questions");

    // check if all questions answered — compute session summary
    const answered = session.questions.filter((q) => q.score !== null);

    if (answered.length === session.questions.length) {
      const avgScore =
        answered.reduce((sum, q) => sum + q.score, 0) / answered.length;

      session.avgScore = avgScore;
      session.status = "completed";
      session.weakPoints = answered
        .filter((q) => q.score < 0.6)
        .map((q) => q.q);
      session.strongPoints = answered
        .filter((q) => q.score > 0.8)
        .map((q) => q.q);
    } else {
      session.status = "in_progress";
    }

    await session.save();

    return res.status(200).json({
      success: true,
      score: parsed.score,
      feedback: session.questions[questionIndex].feedback,
      sessionStatus: session.status,
      avgScore: session.avgScore,
    });
  } catch (err) {
    console.error("[prep] submitAnswer failed:", err.message);
    return res.status(500).json({ message: err.message });
  }
};
