# Generate updater.json after building a new version
# Run this AFTER npx tauri build

param(
    [Parameter(Mandatory)]
    [string]$NewVersion,
    [string]$Notes = "Nova versao com melhorias e correcoes",
    [string]$ProjectRoot = "D:\Projeto Fluxcodex\ai-app-builder"
)

$installer = "$ProjectRoot\src-tauri\target\release\bundle\nsis\AI App Builder Studio_${NewVersion}_x64-setup.exe"

if (-not (Test-Path $installer)) {
    Write-Error "Installer not found. Run 'npx tauri build' first."
    exit 1
}

$json = @{
    version = $NewVersion
    notes = $Notes
    pub_date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{
        "windows-x86_64" = @{
            signature = ""
            url = "file:///$($installer -replace '\\', '/')"
        }
    }
} | ConvertTo-Json -Depth 10

$json | Out-File -LiteralPath "$ProjectRoot\updater.json" -Encoding UTF8

Write-Output "updater.json generated: version $NewVersion"
Write-Output "Path: $ProjectRoot\updater.json"
Write-Output ""
Write-Output "The app will find this update when clicking 'Verificar' in Settings."
