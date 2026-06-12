export interface SubTask {
  id: string;
  description: string;
  sensitivity: "high" | "low";
  complexity: "low" | "medium" | "high";
  backend: "local_qwen3" | "groq" | "gemini";
  depends_on: string[];
  context_keys: string[];
  status?: "pending" | "running" | "completed" | "error";
  output?: string;
  latency_ms?: number;
  cost_usd?: number;
  redacted_keys?: string[];
}

export interface TaskResult {
  task_id: string;
  output: string;
  backend: string;
  latency_ms: number;
  cost_usd: number;
  redacted_keys: string[];
  token_count: number;
}

export interface DecompositionResult {
  tasks: SubTask[];
  synthesis_hint: string;
}

export interface SessionStats {
  totalQueries: number;
  totalCost: number;
  totalLatencySaved: number;
}

/** Per-session timing breakdown shown in the top bar */
export interface TimingMetrics {
  sequentialMs: number;   // sum of all task latency_ms
  parallelMs: number;     // actual wall-clock from query sent → synthesis_complete
  savedMs: number;        // sequential - parallel
  savedPct: number;       // (saved / sequential) * 100
}

export interface Settings {
  localUrl: string;
  groqKey: string;
  geminiKey: string;
  groqModel: string;
  geminiModel: string;
  maxTokensLocal: number;
  maxTokensGroq: number;
  maxTokensGemini: number;
  costLimit: number;
  decompTemp: number;
  showPreview: boolean;
  autoExport: boolean;
}

export interface HistorySession {
  session_id: string;
  query: string;
  context: Record<string, any>;
  results: TaskResult[];
  synthesis: string;
  created_at: string;
}

export type PrismEvent =
  | { type: "decomp_complete"; tasks: SubTask[]; session_id: string }
  | { type: "task_start"; task_id: string; backend: string; redacted_count: number; redacted_keys: string[]; session_id: string }
  | { type: "task_chunk"; task_id: string; chunk: string; session_id: string }
  | { type: "task_complete"; task_id: string; latency_ms: number; tokens: number; cost_usd: number; redacted_keys: string[]; session_id: string }
  | { type: "task_error"; task_id: string; error: string; session_id: string }
  | { type: "synthesis_start"; session_id: string }
  | { type: "synthesis_chunk"; chunk: string; session_id: string }
  | { type: "synthesis_complete"; audit: TaskResult[]; session_id: string }
  | { type: "error"; message: string; session_id?: string };

// Secret Scanner types
export interface SecretFinding {
  type: string;
  line: number;
  preview: string;
  placeholder: string;
  severity: "critical" | "high" | "medium";
}

export interface ScanResult {
  filename: string;
  secrets_found: SecretFinding[];
  total: number;
  safe: boolean;
  summary: {
    critical: number;
    high: number;
    medium: number;
  };
}
