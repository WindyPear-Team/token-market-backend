# Edition Workflow

The project root is the private repository. The `community/` directory is a nested public repository with its own `.git`.

Do not push the private repository to a public remote. Publish from `community/` only.

## One-Line Commands

Commit the private repository:

```powershell
git add -A; git commit -m "Update private edition"
```

Sync and commit the community repository:

```powershell
robocopy . community /MIR /XD .git .claude community dist scripts web\node_modules web\.yarn web\dist web\dist-community web\dist-premium /XF *premium*.go .env flai.db flai.exe flai.exe~ *.log *.exe; if ($LASTEXITCODE -gt 7) { exit $LASTEXITCODE }; New-Item -ItemType Directory -Force community\web\dist-community | Out-Null; Set-Content -Encoding UTF8 community\web\dist-community\placeholder.txt "This file keeps the community frontend embed directory present in source checkouts."; git -C community add -A; git -C community commit -m "Sync community"
```

Build the community edition:

```powershell
Get-ChildItem web\dist-community -Force | Where-Object { $_.Name -ne "placeholder.txt" } | Remove-Item -Recurse -Force; $env:VITE_EDITION="community"; Push-Location web; yarn.cmd build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; Pop-Location; go build -o dist\flai-community.exe .
```

Build the premium edition:

```powershell
Get-ChildItem web\dist-premium -Force | Where-Object { $_.Name -ne "placeholder.txt" } | Remove-Item -Recurse -Force; $env:VITE_EDITION="premium"; Push-Location web; yarn.cmd build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; Pop-Location; go build -tags premium -o dist\flai-premium.exe .
```

## Rules

- Premium Go code must live in files matching `*premium*.go`.
- Community fallback code should live in files matching `*community*.go`.
- `community/` is ignored by the private repository and should be pushed to the public remote from inside `community/`.
