# build.ps1 - Build script for BobTile
param(
    [switch]$Release,
    [switch]$Clean
)

$projectPath = "src/BobTile/BobTile.csproj"
$outputPath = "publish"

if ($Clean) {
    Write-Host "Cleaning..." -ForegroundColor Yellow
    dotnet clean $projectPath
    if (Test-Path $outputPath) {
        Remove-Item -Recurse -Force $outputPath
    }
}

if ($Release) {
    Write-Host "Building Release..." -ForegroundColor Green
    dotnet publish $projectPath `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -p:PublishSingleFile=true `
        -p:EnableCompressionInSingleFile=true `
        -o $outputPath

    if ($LASTEXITCODE -eq 0) {
        $exe = Get-Item "$outputPath/BobTile.exe"
        Write-Host "Built: $($exe.FullName)" -ForegroundColor Cyan
        Write-Host "Size: $([math]::Round($exe.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    }
} else {
    Write-Host "Building Debug..." -ForegroundColor Yellow
    dotnet build $projectPath -c Debug
}
