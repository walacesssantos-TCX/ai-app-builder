# Generate app icons from logo PNG
param(
    [string]$SourceImage = "D:\Projeto Fluxcodex\ChatGPT Image 9 de jun. de 2026, 22_48_55.png",
    [string]$IconsDir = "D:\Projeto Fluxcodex\ai-app-builder\src-tauri\icons"
)

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$tmpDir = Join-Path $env:TEMP "_ico_$(Get-Random)"
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

# Generate PNGs at each size
$pngFiles = @{}
foreach ($s in $sizes) {
    $out = Join-Path $tmpDir "$s.png"
    $img = [System.Drawing.Image]::FromFile($SourceImage)
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $s, $s)
    $g.Dispose()
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $img.Dispose()
    $pngFiles[$s] = [System.IO.File]::ReadAllBytes($out)
}

# Generate 32x32, 128x128, 128x128@2x, icon.png for Tauri
$iconSizes = @(
    @{Name="32x32.png"; Size=32},
    @{Name="128x128.png"; Size=128},
    @{Name="128x128@2x.png"; Size=256},
    @{Name="icon.png"; Size=512}
)
foreach ($icon in $iconSizes) {
    $outPath = Join-Path $IconsDir $icon.Name
    $img = [System.Drawing.Image]::FromFile($SourceImage)
    $bmp = New-Object System.Drawing.Bitmap($icon.Size, $icon.Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $icon.Size, $icon.Size)
    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $img.Dispose()
    Write-Output "Generated $($icon.Name)"
}

# Write ICO file (ICONDIR + ICONDIRENTRY + PNG data)
$icoPath = Join-Path $IconsDir "icon.ico"
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header
$bw.Write([UInt16]0)        # reserved
$bw.Write([UInt16]1)        # ICO type
$bw.Write([UInt16]$sizes.Count)  # image count

# Calculate offset: header + all entries
$offset = 6 + $sizes.Count * 16
$entries = @()

foreach ($s in $sizes) {
    $data = $pngFiles[$s]
    $w = If ($s -ge 256) { 0 } Else { $s }
    $h = If ($s -ge 256) { 0 } Else { $s }
    $entries += @{
        Width = [Byte]$w
        Height = [Byte]$h
        Data = $data
        Offset = $offset
    }
    $offset += $data.Length
}

# Write ICONDIRENTRY for each
foreach ($entry in $entries) {
    $bw.Write([Byte]$entry.Width)
    $bw.Write([Byte]$entry.Height)
    $bw.Write([Byte]0)       # colors
    $bw.Write([Byte]0)       # reserved
    $bw.Write([UInt16]1)     # color planes
    $bw.Write([UInt16]32)    # bits per pixel
    $bw.Write([UInt32]$entry.Data.Length)
    $bw.Write([UInt32]$entry.Offset)
}

# Write PNG data for each
foreach ($entry in $entries) {
    $bw.Write($entry.Data)
}

$bw.Flush()
$bw.Dispose()
$fs.Dispose()

Remove-Item -LiteralPath $tmpDir -Recurse -Force

Write-Output "ICO generated: $icoPath"
