# ============================================================
#  PRISM DEMO LAUNCHER
#  Starts: llama-server (Qwen3) → FastAPI backend → React UI
# ============================================================

$LLAMA_EXE  = "C:\Users\soulp\Desktop\Projects\llama.cpp\llama-server.exe"
$MODEL      = "C:\Users\soulp\Desktop\Projects\models\Qwen_Qwen3.6-35B-A3B-IQ3_M.gguf"
$PRISM_ROOT = "C:\Users\soulp\Desktop\Projects\Prism"
$LLM_PORT   = 11434
$API_PORT   = 8000
$UI_PORT    = 3000

# ── CUDA sanity check ────────────────────────────────────────
Write-Host ""
Write-Host "  PRISM DEMO LAUNCHER" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray

$cudaLine = nvidia-smi 2>$null | Select-String "CUDA Version"
if ($cudaLine -match "13\.2") {
    Write-Host ""
    Write-Host "  ⚠  WARNING: CUDA 13.2 detected!" -ForegroundColor Red
    Write-Host "     Qwen3 produces gibberish outputs with CUDA 13.2." -ForegroundColor Red
    Write-Host "     Update your GPU drivers before running the model." -ForegroundColor Red
    Write-Host "     https://www.nvidia.com/drivers" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "  Continue anyway? (y/N)"
    if ($continue -ne "y") { exit 1 }
} elseif ($cudaLine) {
    Write-Host "  ✓ CUDA: $($cudaLine.ToString().Trim())" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Could not read CUDA version (nvidia-smi not found?)" -ForegroundColor Yellow
}

# ── Prereq checks ────────────────────────────────────────────
if (-not (Test-Path $LLAMA_EXE)) {
    Write-Host ""
    Write-Host "  ✗ llama-server not found at: $LLAMA_EXE" -ForegroundColor Red
    Write-Host "    Download from: https://github.com/ggerganov/llama.cpp/releases" -ForegroundColor Yellow
    Write-Host "    Get: llama-b<latest>-bin-win-cuda-cu12.2.1-x64.zip" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $MODEL)) {
    Write-Host ""
    Write-Host "  ✗ Model not found at: $MODEL" -ForegroundColor Red
    Write-Host "    Download: huggingface-cli download bartowski/Qwen_Qwen3.6-35B-A3B-GGUF Qwen_Qwen3.6-35B-A3B-IQ3_M.gguf --local-dir C:\models\" -ForegroundColor Yellow
    exit 1
}

# ── 1. llama-server ──────────────────────────────────────────
Write-Host ""
Write-Host "  [1/4] Loading Qwen3.6-35B-A3B (IQ3_M)..." -ForegroundColor Yellow
Write-Host "        This takes 30-90s on first load." -ForegroundColor DarkGray

Start-Process -FilePath $LLAMA_EXE -ArgumentList @(
    "--model",         $MODEL,
    "--host",          "127.0.0.1",
    "--port",          "$LLM_PORT",
    "--ctx-size",      "8192",        # 8K — enough for Prism tasks, saves VRAM
    "--n-gpu-layers",  "99",          # push all layers to RTX 4060
    "--flash-attn",    "on",             # ~30% VRAM reduction for attention, better throughput
    "--cache-type-k",  "q8_0",        # halves KV cache vs default f16
    "--cache-type-v",  "q8_0",
    "--threads",       "8",           # Ryzen 7 7735HS perf cores
    "--no-mmap",                      # prevents paging lag
    "--jinja",                        # required for Qwen3 chat template + enable_thinking flag
    "-ot",             ".ffn_.*_exps.=CPU"  # MoE: active experts on GPU, inactive spill to RAM
) -WindowStyle Minimized

# Poll health endpoint until ready (max 2 min)
$ready = $false; $elapsed = 0
while (-not $ready -and $elapsed -lt 120) {
    Start-Sleep -Seconds 3
    $elapsed += 3
    try {
        $r = Invoke-WebRequest "http://127.0.0.1:$LLM_PORT/health" -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true }
    } catch {}
    Write-Host "        Waiting... $($elapsed)s`r" -NoNewline -ForegroundColor DarkGray
}

if ($ready) {
    Write-Host "  ✓ Model loaded                              " -ForegroundColor Green
} else {
    Write-Host "  ⚠ Model still loading — continuing anyway  " -ForegroundColor Yellow
}

# ── 2. FastAPI backend ────────────────────────────────────────
Write-Host "  [2/4] Starting Prism backend (port $API_PORT)..." -ForegroundColor Yellow
Start-Process "python" `
    -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port $API_PORT" `
    -WorkingDirectory $PRISM_ROOT `
    -WindowStyle Minimized
Start-Sleep -Seconds 3
Write-Host "  ✓ Backend on :$API_PORT" -ForegroundColor Green

# ── 3. React frontend ─────────────────────────────────────────
Write-Host "  [3/4] Starting frontend (port $UI_PORT)..." -ForegroundColor Yellow
Start-Process "cmd.exe" `
    -ArgumentList "/c cd /d `"$PRISM_ROOT\frontend`" && npm run dev -- --port $UI_PORT" `
    -WindowStyle Minimized
Start-Sleep -Seconds 5
Write-Host "  ✓ Frontend on :$UI_PORT" -ForegroundColor Green

# ── 4. Warmup ─────────────────────────────────────────────────
Write-Host "  [4/4] Warming up model (first token)..." -ForegroundColor Yellow
try {
    Invoke-WebRequest "http://127.0.0.1:$LLM_PORT/v1/completions" `
        -Method POST -ContentType "application/json" `
        -Body '{"prompt":"hello","max_tokens":5}' `
        -TimeoutSec 60 -ErrorAction Stop | Out-Null
    Write-Host "  ✓ Model is warm" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Warmup timed out — model may still be loading" -ForegroundColor Yellow
}

# ── Open browser ──────────────────────────────────────────────
Start-Sleep -Seconds 1
Start-Process "http://localhost:$UI_PORT"

Write-Host ""
Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  PRISM IS READY" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard : http://localhost:$UI_PORT" -ForegroundColor White
Write-Host "  Backend   : http://localhost:$API_PORT" -ForegroundColor White
Write-Host "  Model API : http://127.0.0.1:$LLM_PORT" -ForegroundColor White
Write-Host "  ─────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To stop everything: close this window and kill llama-server" -ForegroundColor DarkGray
Write-Host ""
