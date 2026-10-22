param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Create', 'Verify')]
    [string] $Phase,
    [Parameter(Mandatory = $true)]
    [string] $StateFile,
    [string] $ApiBaseUrl = 'http://127.0.0.1:18080'
)

$ErrorActionPreference = 'Stop'
$endpoint = "$($ApiBaseUrl.TrimEnd('/'))/api/v1/documents"

function Assert-True([bool] $condition, [string] $message) {
    if (-not $condition) { throw $message }
}

function Read-Document([string] $id) {
    return Invoke-RestMethod -Uri "$endpoint/$id" -Method Get
}

function Verify-DecidedDocument([object] $entry) {
    $id = $entry.id
    $result = Read-Document $id
    Assert-True ($result.status -eq $entry.status) "Unexpected result status for $id"
    if ($entry.kind -eq 'FILE') {
        $client = [System.Net.Http.HttpClient]::new()
        try {
            $bytes = $client.GetByteArrayAsync("$endpoint/$id/content").GetAwaiter().GetResult()
            $actualHash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($bytes))
            Assert-True ($actualHash -eq $entry.sha256) "Original file changed for $id"
        } finally { $client.Dispose() }
    } else {
        $content = Invoke-RestMethod -Uri "$endpoint/$id/content" -Method Get
        Assert-True ($content.document_text -eq $entry.text) "Original text changed for $id"
    }
    $history = Invoke-RestMethod -Uri "$endpoint/$id/history" -Method Get
    Assert-True ($history.entries.Count -eq 2) "Expected initial and review history for $id"
    Assert-True ($history.entries[-1].result.status -eq $entry.status) "History result mismatch for $id"
    $expectedDecision = if ($entry.status -eq 'APPROVED') { 'APPROVE' } else { 'REJECT' }
    Assert-True ($history.entries[-1].decision -eq $expectedDecision) "History decision mismatch for $id"
}

if ($Phase -eq 'Create') {
    $suffix = [guid]::NewGuid().ToString('N').Substring(0, 12)
    $documents = @(
        @{ id = "LOCAL-APPROVE-$suffix"; kind = 'TEXT'; text = 'Documento sintético de estudio. Paciente: Ana Demo. Solicitud: revisión clínica.'; status = 'APPROVED' },
        @{ id = "LOCAL-REJECT-$suffix"; kind = 'TEXT'; text = 'Documento sintético incompleto. Paciente: Luis Demo. Sin datos clínicos verificables.'; status = 'REJECTED' },
        @{ id = "LOCAL-FILE-$suffix"; kind = 'FILE'; status = 'REJECTED' }
    )
    foreach ($document in $documents | Where-Object { $_.kind -eq 'TEXT' }) {
        $request = @{ document_id = $document.id; document_text = $document.text; origin_channel = 'local-demo' } |
            ConvertTo-Json -Depth 8
        $processed = Invoke-RestMethod -Uri "$endpoint/process-text" -Method Post -ContentType 'application/json' -Body $request
        Assert-True ($processed.document_id -eq $document.id -and $processed.status -eq 'NEEDS_AUDIT') "Processing did not queue $($document.id)"
    }
    $syntheticFile = Join-Path $PSScriptRoot '..\test-data\cases\CASE-010\input.jpg'
    $documents[2].sha256 = (Get-FileHash -LiteralPath $syntheticFile -Algorithm SHA256).Hash
    $fileResponse = curl.exe --fail-with-body -sS -F "file=@$syntheticFile;type=image/jpeg" -F 'origin_channel=local-demo' -F "document_id=$($documents[2].id)" "$endpoint/process-file"
    if ($LASTEXITCODE -ne 0) { throw "File processing failed: $fileResponse" }
    $fileResult = $fileResponse | ConvertFrom-Json
    Assert-True ($fileResult.document_id -eq $documents[2].id -and $fileResult.status -eq 'NEEDS_AUDIT') 'File did not enter Audit'

    $queue = @(Invoke-RestMethod -Uri "$endpoint/audit" -Method Get)
    foreach ($document in $documents) {
        Assert-True ([bool]($queue | Where-Object { $_.document_id -eq $document.id -and $_.status -eq 'NEEDS_AUDIT' })) "Audit queue is missing $($document.id)"
        $before = Read-Document $document.id
        Assert-True ($before.status -eq 'NEEDS_AUDIT') "Review result mismatch for $($document.id)"
        if ($document.kind -eq 'TEXT') {
            $original = Invoke-RestMethod -Uri "$endpoint/$($document.id)/content" -Method Get
            Assert-True ($original.document_text -eq $document.text) "Review content mismatch for $($document.id)"
        }
    }

    $approval = @{
        decision = 'APPROVE'
        classification = @{ document_type = 'STUDY_REPORT'; specialty = 'Medicina General'; priority_level = 'ROUTINE' }
        extracted_data = @{ patient = @{ name = 'Ana Demo' }; requested_studies = @() }
        validation = @{ missing_fields = @(); inconsistencies = @(); warnings = @('Revisado en local-demo') }
        routing_decision = @{ primary_destination = 'MEDICAL_RECORD' }
    } | ConvertTo-Json -Depth 12
    $approved = Invoke-RestMethod -Uri "$endpoint/$($documents[0].id)/review" -Method Patch -ContentType 'application/json' -Body $approval
    Assert-True ($approved.status -eq 'APPROVED') 'APPROVE failed'

    $rejection = @{ decision = 'REJECT' } | ConvertTo-Json
    $rejected = Invoke-RestMethod -Uri "$endpoint/$($documents[1].id)/review" -Method Patch -ContentType 'application/json' -Body $rejection
    Assert-True ($rejected.status -eq 'REJECTED') 'REJECT failed'
    $rejectedFile = Invoke-RestMethod -Uri "$endpoint/$($documents[2].id)/review" -Method Patch -ContentType 'application/json' -Body $rejection
    Assert-True ($rejectedFile.status -eq 'REJECTED') 'FILE REJECT failed'

    $queue = @(Invoke-RestMethod -Uri "$endpoint/audit" -Method Get)
    foreach ($document in $documents) {
        Assert-True (-not ($queue | Where-Object { $_.document_id -eq $document.id })) "Decided document remained in Audit: $($document.id)"
        Verify-DecidedDocument $document
    }
    @{ documents = $documents } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $StateFile -Encoding utf8
    Write-Output "Created and verified synthetic APPROVE/REJECT workflow; state: $StateFile"
} else {
    $state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
    $queue = @(Invoke-RestMethod -Uri "$endpoint/audit" -Method Get)
    foreach ($document in $state.documents) {
        Assert-True (-not ($queue | Where-Object { $_.document_id -eq $document.id })) "Decided document returned to Audit: $($document.id)"
        Verify-DecidedDocument $document
    }
    Write-Output 'Persisted results, originals, queue and history verified after restart.'
}
