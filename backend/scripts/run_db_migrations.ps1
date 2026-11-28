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

foreach ($required in @(
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'DB_SSL_CA'
)) {
    if (-not $values.ContainsKey($required) -or -not $values[$required]) {
        throw "Missing $required in backend/.env.migrate."
    }
}

$dbPort = 0
if (-not [int]::TryParse($values['DB_PORT'], [ref]$dbPort) -or
    $dbPort -lt 1 -or $dbPort -gt 65535) {
    throw 'DB_PORT in backend/.env.migrate must be between 1 and 65535.'
}

$environmentKeys = @(
    'APP_ENV',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'DB_SSL_CA'
)
$previousEnvironment = @{}
$previousEnvironment['APP_ENV'] = [Environment]::GetEnvironmentVariable(
    'APP_ENV',
    'Process'
)
foreach ($key in $environmentKeys | Where-Object { $_ -ne 'APP_ENV' }) {
    $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable(
        $key,
        'Process'
    )
}

$env:APP_ENV = 'migration'
$env:DB_HOST = $values['DB_HOST']
$env:DB_PORT = [string]$dbPort
$env:DB_NAME = $values['DB_NAME']
$env:DB_USER = $values['DB_USER']
$env:DB_PASSWORD = $values['DB_PASSWORD']
$env:DB_SSL_CA = $values['DB_SSL_CA']
$exitCode = 0

Push-Location $backendRoot
try {
    python -m flask --app app init-db
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
    foreach ($key in $environmentKeys) {
        [Environment]::SetEnvironmentVariable(
            $key,
            $previousEnvironment[$key],
            'Process'
        )
    }
}

exit $exitCode
