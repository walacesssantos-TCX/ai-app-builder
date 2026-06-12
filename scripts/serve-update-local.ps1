# Script para testar o updater localmente
# Gera updater.json com assinatura e serve via HTTP local

$projectRoot = "D:\Projeto Fluxcodex\ai-app-builder"
$installer = "$projectRoot\src-tauri\target\release\bundle\nsis\AI App Builder Studio_0.1.0_x64-setup.exe"
$keyFile = "$env:USERPROFILE\.tauri\ai-updater.key"
$updaterJson = "$projectRoot\updater.json"
$port = 3002

if (-not (Test-Path $installer)) {
    Write-Error "Installer not found. Run 'npx tauri build' first."
    exit 1
}
if (-not (Test-Path $keyFile)) {
    Write-Error "Signing key not found at $keyFile"
    exit 1
}

Write-Output "Signing installer..."
$sigOutput = & npx tauri signer sign --key "$keyFile" --password "" "$installer" 2>&1
$signature = ($sigOutput | Select-String -Pattern 'signature:\s*(.+)' | ForEach-Object { $_.Matches.Groups[1].Value.Trim() })

if (-not $signature) {
    Write-Error "Failed to generate signature"
    exit 1
}

Write-Output "Signature: $signature"

# Criar updater.json com versão simulada 0.1.1
$json = @{
    version = "0.1.1"
    notes = "Versão de teste local`n- Skills built-in incorporadas`n- Suporte a Groq adicionado"
    pub_date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{
        "windows-x86_64" = @{
            signature = $signature
            url = "http://127.0.0.1:$port/AI%20App%20Builder%20Studio_0.1.0_x64-setup.exe"
        }
    }
} | ConvertTo-Json -Depth 10

$json | Out-File -LiteralPath $updaterJson -Encoding UTF8
Write-Output "updater.json created"

Write-Output "Starting local HTTP server on port $port..."
Write-Output ""
Write-Output "=== HOW TO TEST ==="
Write-Output "1. Install the current app (run the setup.exe)"
Write-Output "2. Then run this script BEFORE clicking 'Verificar'"
Write-Output "3. Click 'Verificar' in Settings > Atualizar"
Write-Output ""
Write-Output "NOTE: By default the app points to GitHub."
Write-Output "To test locally, change the endpoint in tauri.conf.json to:"
Write-Output "  http://127.0.0.1:$port/updater.json"
Write-Output "Then rebuild with: npx tauri build"
Write-Output "====================="
Write-Output ""

# Simple HTTP server using PowerShell
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$port/")
$listener.Start()
Write-Output "Serving at http://127.0.0.1:$port/ (Ctrl+C to stop)"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $localPath = $request.Url.LocalPath.Trim('/')
        Write-Output "  GET /$localPath"

        if ($localPath -eq "updater.json") {
            $content = [System.IO.File]::ReadAllBytes($updaterJson)
            $response.ContentType = "application/json"
            $response.OutputStream.Write($content, 0, $content.Length)
        } elseif ($localPath -like "*.exe") {
            $exePath = $installer
            if (Test-Path $exePath) {
                $content = [System.IO.File]::ReadAllBytes($exePath)
                $response.ContentType = "application/octet-stream"
                $response.OutputStream.Write($content, 0, $content.Length)
            } else {
                $response.StatusCode = 404
            }
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
