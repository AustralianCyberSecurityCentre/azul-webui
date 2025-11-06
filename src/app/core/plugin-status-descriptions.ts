export const STATUS_DESCRIPTIONS = {
  // 'virtual' status so does not have a description in bedrock
  prefiltered:
    "This binary doesn't appear to be compatible with this plugin and so the plugin should not execute. Check the details for precise filter applied.",
  queued:
    "This binary has passed prefiltering for the plugin and should be queued for processing.",
  "heartbeat-lost":
    "Plugin was analysing binary but stopped reporting for some unknown reason.",
  // statuses that exist in bedrock
  completed: "Plugin has run over binary and produced results.",
  "completed-empty":
    "Plugin has run over binary but did not produce anything interesting.",
  "completed-with-errors":
    "Plugin has run over a binary and encountered a non-critical error.",
  "opt-out": "Plugin decided the binary was not suitable for analysis.",
  heartbeat: "Plugin is currently analysing file.",
  dequeued: "Plugin has recently received file for analysis.",
  "error-exception": "Plugin encountered a fatal exception during processing.",
  "error-network":
    "Plugin encountered a fatal network issue during processing.",
  "error-runner":
    "Plugin encountered a fatal error in the runner framework during processing.",
  "error-input": "Plugin input was corrupt or raised an issue.",
  "error-output": "Plugin output was corrupt or raised an issue.",
  "error-timeout": "Plugin took too long to analyse binary.",
  "error-out-of-memory": "Plugin used too much memory during processing.",
};
