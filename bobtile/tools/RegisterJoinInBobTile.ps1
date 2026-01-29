param(
    [string]$ExePath = (Resolve-Path "$PSScriptRoot\..\publish\BobTile.exe").Path
)

$iconPath = (Resolve-Path "$PSScriptRoot\..\bobtile_icon.ico").Path

if (-not (Test-Path $ExePath)) {
    Write-Error "BobTile.exe not found. Build first or pass -ExePath to the script."
    exit 1
}

$baseKey = "HKCU:\Software\Classes\SystemFileAssociations\image\shell\BobTileJoin"
New-Item -Path $baseKey -Force | Out-Null
New-ItemProperty -Path $baseKey -Name "(Default)" -Value "Join in BobTile" -Force | Out-Null
New-ItemProperty -Path $baseKey -Name "Icon" -Value $iconPath -Force | Out-Null
New-ItemProperty -Path $baseKey -Name "MultiSelectModel" -Value "Single" -Force | Out-Null

$commandKey = Join-Path $baseKey "command"
New-Item -Path $commandKey -Force | Out-Null
$command = "`"$ExePath`" --join `"%1`""
New-ItemProperty -Path $commandKey -Name "(Default)" -Value $command -Force | Out-Null

Write-Host "Registered 'Join in BobTile' for image files."