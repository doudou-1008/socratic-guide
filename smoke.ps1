# smoke.ps1 —— 一键本地自检（Windows PowerShell）
# 用法：右键"使用 PowerShell 运行"，或 powershell -ExecutionPolicy Bypass -File smoke.ps1

function Check($name, $uri) {
  try {
    Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop | Out-Null
    Write-Host "$name OK"
  } catch {
    Write-Host "$name 未启动/不可达"
  }
}

Write-Host "==> 检查后端存活"
Check "后端" "http://127.0.0.1:8000/docs"

Write-Host "==> 检查前端可达"
Check "前端" "http://127.0.0.1:3000"

Write-Host "==> 检查 /chat (POST)"
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/chat" `
        -Method POST -ContentType 'application/json' `
        -Body '{"message":"你好","history":[],"track":"programming","user_id":"smoke-test"}' `
        -UseBasicParsing -TimeoutSec 10
  Write-Host "/chat OK ($(($r.Content).Length) 字节)"
} catch {
  Write-Host "/chat 异常: $_"
}
