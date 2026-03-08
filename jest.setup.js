// Silence "not configured to support act(...)" when using React 18+ createRoot in tests
if (typeof globalThis.IS_REACT_ACT_ENVIRONMENT === "undefined") {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}
