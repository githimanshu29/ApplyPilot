import { StateGraph, START, END } from "@langchain/langgraph";
import { ApplyAIState } from "./state.js";
import { jdParserNode } from "./nodes/jdParser.js";
import { fitScorerNode } from "./nodes/fitScorer.js";
import { atsScannerNode } from "./nodes/atsScanner.js";
import { gapAnalyzerNode } from "./nodes/gapAnalyser.js";
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

let compiledGraph = null;

export function getGraph() {
  if (compiledGraph) return compiledGraph;

  const graph = new StateGraph(ApplyAIState);

  // ── nodes ──────────────────────────────────────────────
  graph.addNode("jd_parser", jdParserNode);
  graph.addNode("fit_scorer", fitScorerNode);
  graph.addNode("ats_scanner", atsScannerNode);
  graph.addNode("gap_analyzer", gapAnalyzerNode);
  graph.addNode("bullet_rewriter", bulletRewriterNode);
  graph.addNode("kw_injector", kwInjectorNode);
  graph.addNode("ats_validator", atsValidatorNode);
  graph.addNode("pdf_builder", pdfBuilderNode);
  graph.addNode("crm_logger", crmLoggerNode);

  // ── edges ──────────────────────────────────────────────

  graph.addEdge(START, "jd_parser");

  // parallel fan-out — LangGraph natively waits for BOTH before running gap_analyzer
  // no join guard node needed — that's built into how LangGraph handles multiple incoming edges
  graph.addEdge("jd_parser", "fit_scorer");
  graph.addEdge("jd_parser", "ats_scanner");
  graph.addEdge("fit_scorer", "gap_analyzer");
  graph.addEdge("ats_scanner", "gap_analyzer");

  // bullet quality loop
  graph.addEdge("gap_analyzer", "bullet_rewriter");
  graph.addConditionalEdges("bullet_rewriter", shouldRetryBullets);

  // ATS score loop
  graph.addEdge("kw_injector", "ats_validator");
  graph.addConditionalEdges("ats_validator", shouldContinueAfterValidation);

  // terminal
  graph.addEdge("pdf_builder", "crm_logger");
  graph.addEdge("crm_logger", END);

  compiledGraph = graph.compile();
  return compiledGraph;
}
