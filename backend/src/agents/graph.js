import { StateGraph, START, END } from "@langchain/langgraph";
import { ApplyAIState } from "./state.js";

import { jdParserNode } from "./nodes/jdParser.js";
import { fitScorerNode } from "./nodes/fitScorer.js";
import { atsScannerNode } from "./nodes/atsScanner.js";
import { gapAnalyzerNode } from "./nodes/gapAnalyzer.js";

import {
  bulletRewriterNode,
  shouldRetryBullets,
} from "./nodes/bulletRewriter.js";

import { kwInjectorNode } from "./nodes/kwInjector.js";

import {
  atsValidatorNode,
  shouldContinueAfterValidation,
} from "./nodes/atsValidator.js";

import { pdfBuilderNode } from "./nodes/pdfBuilder.js";
import { crmLoggerNode } from "./nodes/crmLogger.js";

// Redis checkpointing
import { RedisSaver } from "@langchain/langgraph-checkpoint-redis";
import Redis from "ioredis";

let compiledGraph = null;

export function getGraph() {
  if (compiledGraph) return compiledGraph;

  const graph = new StateGraph(ApplyAIState);

  // NODES

  graph.addNode("jd_parser", jdParserNode);
  graph.addNode("fit_scorer", fitScorerNode);
  graph.addNode("ats_scanner", atsScannerNode);

  // JOIN GUARD NODE (ensures both parallel nodes finished)
  graph.addNode("analysis_join", async (state) => {
    if (!state.fitDetails || !state.presentKeywords) {
      // wait until both are ready
      return { ...state };
    }
    return state;
  });

  graph.addNode("gap_analyzer", gapAnalyzerNode);

  graph.addNode("bullet_rewriter", bulletRewriterNode);
  graph.addNode("kw_injector", kwInjectorNode);
  graph.addNode("ats_validator", atsValidatorNode);

  // HUMAN REVIEW (interrupt)
  graph.addNode("human_review", async (state) => {
    console.log("[human_review] paused for approval");

    return {
      ...state,
      currentNode: "human_review",
      __interrupt: true,
    };
  });

  graph.addNode("pdf_builder", pdfBuilderNode);
  graph.addNode("crm_logger", crmLoggerNode);

  // FLOW

  graph.addEdge(START, "jd_parser");

  //  parallel execution
  graph.addEdge("jd_parser", "fit_scorer");
  graph.addEdge("jd_parser", "ats_scanner");

  // safe join
  graph.addEdge("fit_scorer", "analysis_join");
  graph.addEdge("ats_scanner", "analysis_join");

  graph.addEdge("analysis_join", "gap_analyzer");

  // bullet optimization loop
  graph.addEdge("gap_analyzer", "bullet_rewriter");

  graph.addConditionalEdges("bullet_rewriter", shouldRetryBullets, {
    bullet_rewriter: "bullet_rewriter",
    kw_injector: "kw_injector",
  });

  // ATS optimization loop
  graph.addEdge("kw_injector", "ats_validator");

  graph.addConditionalEdges("ats_validator", shouldContinueAfterValidation, {
    kw_injector: "kw_injector",
    human_review: "human_review", // aligned
  });

  // resume after approval
  graph.addEdge("human_review", "pdf_builder");

  // final steps
  graph.addEdge("pdf_builder", "crm_logger");
  graph.addEdge("crm_logger", END);

  if (!global._redis) {
    global._redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  const checkpointer = new RedisSaver(global._redis);

  compiledGraph = graph.compile({
    checkpointer,
  });

  return compiledGraph;
}
