import { useState, useEffect, useCallback } from "react";
import { getSocket, getSocketId } from "../lib/socket";

const NODES_IN_ORDER = [
  { key: "jd_parser", label: "Parsing job description", icon: "📋" },
  { key: "fit_scorer", label: "Scoring semantic fit", icon: "📊" },
  { key: "ats_scanner", label: "Scanning ATS keywords", icon: "🔍" },
  { key: "gap_analyzer", label: "Analyzing skill gaps", icon: "🧩" },
  { key: "bullet_rewriter", label: "Rewriting resume bullets", icon: "✏️" },
  { key: "kw_injector", label: "Injecting keywords honestly", icon: "🔑" },
  { key: "ats_validator", label: "Validating ATS score", icon: "✅" },
  { key: "pdf_builder", label: "Building resume JSON", icon: "📄" },
  { key: "crm_logger", label: "Saving results", icon: "💾" },
  {
    key: "interview_prep",
    label: "Generating interview questions",
    icon: "🎯",
  },
];

export function usePipeline() {
  const [state, setState] = useState({
    running: false,
    currentNode: null,
    completedNodes: [],
    applicationId: null,
    result: null,
    error: null,
  });

  useEffect(() => {
    const socket = getSocket();

    socket.on("pipeline:start", ({ applicationId }) => {
      setState({
        running: true,
        currentNode: "jd_parser",
        completedNodes: [],
        applicationId,
        result: null,
        error: null,
      });
    });

    socket.on("pipeline:node", ({ node }) => {
      setState((prev) => ({
        ...prev,
        currentNode: node,
        completedNodes: prev.completedNodes.includes(node)
          ? prev.completedNodes
          : [...prev.completedNodes, node],
      }));
    });

    socket.on("pipeline:complete", (data) => {
      setState((prev) => ({
        ...prev,
        running: false,
        currentNode: null,
        result: data,
        completedNodes: NODES_IN_ORDER.map((n) => n.key),
      }));
    });

    socket.on("pipeline:error", ({ error }) => {
      setState((prev) => ({
        ...prev,
        running: false,
        error,
      }));
    });

    return () => {
      socket.off("pipeline:start");
      socket.off("pipeline:node");
      socket.off("pipeline:complete");
      socket.off("pipeline:error");
    };
  }, []);

  const reset = useCallback(() => {
    setState({
      running: false,
      currentNode: null,
      completedNodes: [],
      applicationId: null,
      result: null,
      error: null,
    });
  }, []);

  return { ...state, nodes: NODES_IN_ORDER, reset };
}
