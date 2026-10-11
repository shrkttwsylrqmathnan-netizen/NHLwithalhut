# =====================================================================
#  Nahla - cashier printer scan (pos-scan.ps1) - V34.12
#  READ-ONLY: it changes no setting, installs nothing, needs no admin.
#  It reads: printers, ports, print queue, names and paths of open
#  programs (never window titles; the Windows user name in a path is
#  replaced by *), installed program names, Windows version. Not the
#  computer name. Then it sends them to Nahla with the one-time code shown
#  in the Nahla restaurant panel. If sending fails, the result is
#  copied so the cashier can paste it into the panel instead.
#
#  The panel puts two lines before this file ($nahlaPhone, $nahlaCode).
#  $nahlaDryRun = $true prints the JSON instead (for testing).
#  NO blank lines inside the block: a pasted blank line ends a block early
#  in the classic console. Everything runs inside ONE block "& { ... }": when the text is pasted
#  line by line into a console, "return" still stops it, and nothing
#  (not even $ErrorActionPreference) leaks into the cashier's session.
# =====================================================================
& {
    $ErrorActionPreference = 'SilentlyContinue'
    if ($PSVersionTable.PSVersion.Major -lt 3) {
        Write-Host ''
        Write-Host '  This Windows is too old for the Nahla scan (PowerShell 2 / Windows 7).' -ForegroundColor Yellow
        Write-Host '  Nothing was sent. Please tell Nahla: "Windows 7".' -ForegroundColor Yellow
        Write-Host ''
        return
    }
    function Get-NahlaWmi([string]$cls) {
        if (Get-Command Get-CimInstance -ErrorAction SilentlyContinue) { return @(Get-CimInstance -ClassName $cls) }
        return @(Get-WmiObject -Class $cls)
    }
    function Cut([object]$s, [int]$n) {
        if ($null -eq $s) { return '' }
        $t = [string]$s
        if ($t.Length -gt $n) { return $t.Substring(0, $n) }
        return $t
    }
    Write-Host ''
    Write-Host '  Nahla printer scan ... (read-only)' -ForegroundColor Cyan
    # ---- printers (Win32_Printer) ----
    $printers = @(Get-NahlaWmi 'Win32_Printer' | ForEach-Object {
        [pscustomobject]@{
            name      = Cut $_.Name 120
            driver    = Cut $_.DriverName 120
            port      = Cut $_.PortName 120
            default   = [bool]$_.Default
            network   = [bool]$_.Network
            local     = [bool]$_.Local
            shared    = [bool]$_.Shared
            direct    = [bool]$_.Direct
            keep      = [bool]$_.KeepPrintedJobs
            raw_only  = [bool]$_.RawOnly
            datatype  = Cut $_.PrintJobDataType 30
            processor = Cut $_.PrintProcessor 40
            status    = $_.PrinterStatus
            offline   = [bool]$_.WorkOffline
            attrs     = $_.Attributes
        }
    })
    # ---- network printer ports ----
    $tcp = @(Get-NahlaWmi 'Win32_TCPIPPrinterPort' | ForEach-Object {
        [pscustomobject]@{ name = Cut $_.Name 80; host = Cut $_.HostAddress 80; port = $_.PortNumber; protocol = $_.Protocol }
    })
    # ---- jobs waiting in the queue now (document names show how the cashier program names receipts) ----
    $jobs = @(Get-NahlaWmi 'Win32_PrintJob' | Select-Object -First 30 | ForEach-Object {
        [pscustomobject]@{ printer = Cut (([string]$_.Name) -split ',')[0] 120; doc = Cut $_.Document 120; type = Cut $_.DataType 30; size = $_.Size; status = Cut $_.JobStatus 60 }
    })
    # ---- programs with a window open now: name + path only (the cashier program). Window titles are NEVER read ----
    $windows = @(Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object -First 40 | ForEach-Object {
        $path = ''
        try { $path = Cut ($_.Path -replace '(?i)^([A-Z]:\\Users\\)[^\\]+', '$1*') 200 } catch { }
        [pscustomobject]@{ name = Cut $_.ProcessName 60; path = $path }
    })
    # ---- installed programs (names only; Windows/Microsoft updates skipped) ----
    $keys = @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
              'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
              'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*')
    $apps = @($keys | ForEach-Object { Get-ItemProperty -Path $_ } |
        Where-Object { $_.DisplayName -and $_.DisplayName -notmatch '^(Microsoft|Windows|Update for|Security Update|Hotfix|KB\d)' } |
        ForEach-Object { Cut $_.DisplayName 80 } | Sort-Object -Unique | Select-Object -First 150)
    $os = Get-NahlaWmi 'Win32_OperatingSystem' | Select-Object -First 1
    $spool = ''
    try { $spool = Cut (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers').DefaultSpoolDirectory 200 } catch { }
    $isAdmin = $false
    try { $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) } catch { }
    $data = [ordered]@{
        v         = 1
        at        = (Get-Date).ToString('o')
        os        = [ordered]@{ caption = Cut $os.Caption 80; version = Cut $os.Version 30; build = Cut $os.BuildNumber 20; arch = Cut $os.OSArchitecture 20 }
        ps        = Cut $PSVersionTable.PSVersion 20
        admin     = $isAdmin
        spool_dir = $spool
        printers  = $printers
        tcp_ports = $tcp
        jobs      = $jobs
        windows   = $windows
        apps      = $apps
    }
    $json = $data | ConvertTo-Json -Depth 5 -Compress
    if ($nahlaDryRun) { $json; return }
    $sent = $false
    if ($nahlaPhone -and $nahlaCode) {
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
            $body = [ordered]@{ phone = [string]$nahlaPhone; code = [string]$nahlaCode; data = $json } | ConvertTo-Json -Compress
            $wc = New-Object Net.WebClient
            $wc.Encoding = [Text.Encoding]::UTF8
            $wc.Headers['Content-Type'] = 'application/json; charset=utf-8'
            $r = $wc.UploadString('https://europe-west1-nahla-delivery-6b06f.cloudfunctions.net/posSurvey', $body)
            if ($r -match '"ok":true') { $sent = $true }
        } catch { }
    }
    if ($sent) {
        Write-Host ''
        Write-Host ('  OK - sent to Nahla. Printers found: ' + $printers.Count) -ForegroundColor Green
        Write-Host '  You can close this window and go back to the Nahla panel.' -ForegroundColor Green
    } else {
        $out = 'NAHLASCAN1:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
        $copied = $false
        try { Set-Clipboard -Value $out; $copied = $true } catch { }
        if (-not $copied) { try { $out | clip.exe; $copied = $true } catch { } }
        Write-Host ''
        if ($copied) {
            Write-Host '  Could not send directly. The result is COPIED.' -ForegroundColor Yellow
            Write-Host '  Go back to the Nahla panel and paste it (Ctrl+V) in the box, then press Send.' -ForegroundColor Yellow
        } else {
            Write-Host '  Could not send or copy. Select the text below, copy it, and paste it in the Nahla panel:' -ForegroundColor Yellow
            Write-Host $out
        }
    }
    Write-Host ''
}
