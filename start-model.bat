@echo off
title Qwen3.6-35B llama-server
echo.
echo  ==========================================
echo   Qwen3.6-35B-A3B  ^|  llama-server
echo  ==========================================
echo.
echo  Port: 11434
echo  Loading model... (30-90s on first run)
echo.

"C:\Users\soulp\Desktop\Projects\llama.cpp\llama-server.exe" --model "C:\Users\soulp\Desktop\Projects\models\Qwen_Qwen3.6-35B-A3B-IQ3_M.gguf" --host 127.0.0.1 --port 11434 --ctx-size 8192 --n-gpu-layers 99 --flash-attn on --cache-type-k q8_0 --cache-type-v q8_0 --threads 8 --no-mmap --jinja -ot ".ffn_.*_exps.=CPU"

echo.
echo  llama-server stopped.
pause
