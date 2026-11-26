$ErrorActionPreference = 'Stop'

$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $backendRoot '.env.migrate'
if (-not (Test-Path -LiteralPath $envFile)) {
    throw 'Create backend/.env.migrate from backend/.env.migrate.example first.'
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
        continue
    }

    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) {
        throw 'Invalid line in backend/.env.migrate.'
    }

    $key = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if ($value.Length -ge 2 -and
        (($value.StartsWith('"') -and $value.EndsWith('"')) -or
         ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$key] = $value
}

foreach ($required in @('DB_NAME', 'DB_USER', 'DB_PASSWORD')) {
    if (-not $values.ContainsKey($required) -or -not $values[$required]) {
        throw "Missing $required in backend/.env.migrate."
    }
}

$env:APP_ENV = 'development'
$env:DB_NAME = $values['DB_NAME']
$env:DB_USER = $values['DB_USER']
$env:DB_PASSWORD = $values['DB_PASSWORD']
$exitCode = 0

Push-Location $backendRoot
try {
    python -m flask --app app init-db
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
    Remove-Item Env:DB_USER -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
    Remove-Item Env:APP_ENV -ErrorAction SilentlyContinue
}

exit $exitCode
