function Assert-VibeNativeFiles([string[]]$Paths) {
  # An ordinary child process can inherit MSIX redirection. Use the interactive
  # user's WMI process context and compare bytes, not merely Test-Path locally.
  $expected = @($Paths | ForEach-Object {
    if (!(Test-Path -LiteralPath $_ -PathType Leaf)) { throw "Missing setup file: $_" }
    @{ path=[IO.Path]::GetFullPath($_); hash=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }
  })
  $reportDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'VibeCodingDiagnostics'
  New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
  $report = Join-Path $reportDir (([guid]::NewGuid().ToString()) + '.json')
  $inputJson = @{files=$expected; report=$report} | ConvertTo-Json -Depth 5 -Compress
  $payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($inputJson))
  $code = @'
$ErrorActionPreference='Stop'
$inputData = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('PAYLOAD')) | ConvertFrom-Json
try {
  $files = @(foreach ($f in $inputData.files) {
    $hash = if (Test-Path -LiteralPath $f.path -PathType Leaf) { (Get-FileHash -LiteralPath $f.path -Algorithm SHA256).Hash } else { '' }
    @{path=[string]$f.path; hash=[string]$hash}
  })
  $result = @{sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; files=$files}
} catch { $result=@{error=$_.Exception.Message} }
[IO.File]::WriteAllText(($inputData.report + '.tmp'), ($result | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
[IO.File]::Move(($inputData.report + '.tmp'), $inputData.report)
'@
  $code = $code.Replace('PAYLOAD', $payload)
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
  $process = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine="powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand $encoded"}
  if ($process.ReturnValue -ne 0) { throw 'Native filesystem verification could not start. Do not claim installation success.' }
  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  while (!(Test-Path -LiteralPath $report) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
  if (!(Test-Path -LiteralPath $report)) { throw 'Native filesystem verification timed out. Do not create a shortcut.' }
  $actual = [IO.File]::ReadAllText($report) | ConvertFrom-Json
  if ($actual.error -or $actual.sid -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) { throw "Native verification failed or ran as another user. Report: $report" }
  foreach ($f in $expected) {
    $matches = @($actual.files | Where-Object { $_.path -eq $f.path -and $_.hash -eq $f.hash })
    if ($matches.Count -ne 1) { throw "Native filesystem mismatch: $($f.path). Run setup in the interactive user's native context; MSIX redirection may hide this file. Report: $report" }
  }
}
