# Pizza Kuryer: botni Windows kompyuterda sinab ko'rish (faqat chat qismi).
# Maxfiy qiymatlar bu faylda YO'Q: BOT_TOKEN va DATABASE_URL ishga tushirishdan oldin
# $env:BOT_TOKEN va $env:DATABASE_URL orqali beriladi, keyin:
#   irm https://raw.githubusercontent.com/muhammadjonmirzaliyev33-lab/kabobchi-bot/pizza-kuryer/sinash.ps1 | iex
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  try {
    if (-not $env:BOT_TOKEN -or -not $env:DATABASE_URL) {
      throw "BOT_TOKEN yoki DATABASE_URL berilmagan. Buyruqni to'liq nusxalab qo'ying."
    }

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
      Write-Host "Node.js topilmadi, o'rnatilmoqda (Windows ruxsat so'rasa 'Ha' bosing)..." -ForegroundColor Yellow
      if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
      }
      $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
      if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Start-Process 'https://nodejs.org/en/download'
        throw "Node.js o'rnatilmadi. Ochilgan saytdan Node.js (LTS) ni o'rnating, PowerShell'ni yopib qayta oching va buyruqni yana qo'ying."
      }
    }

    $dir = Join-Path $env:USERPROFILE 'pizza-kuryer-test'
    New-Item -ItemType Directory -Force $dir | Out-Null
    Set-Location $dir

    Write-Host '1/3 Kod yuklanmoqda...' -ForegroundColor Cyan
    Invoke-WebRequest 'https://github.com/muhammadjonmirzaliyev33-lab/kabobchi-bot/archive/refs/heads/pizza-kuryer.zip' -OutFile 'code.zip' -UseBasicParsing
    if (Test-Path 'kabobchi-bot-pizza-kuryer') { Remove-Item -Recurse -Force 'kabobchi-bot-pizza-kuryer' }
    Expand-Archive 'code.zip' -DestinationPath . -Force
    Set-Location (Join-Path $dir 'kabobchi-bot-pizza-kuryer\backend')

    Write-Host '2/3 Bot tayyorlanmoqda (1-3 daqiqa, ko''p yozuv chiqadi, bu normal)...' -ForegroundColor Cyan
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install muvaffaqiyatsiz' }

    # Qolgan sozlamalar (maxfiy emas). WEBAPP_URL/WEBHOOK_DOMAIN bo'sh: bot long polling rejimida ishlaydi.
    $env:NODE_ENV = 'development'
    $env:ADMIN_IDS = '1027530770'
    $env:BOT_USERNAME = 'Pizza_kuryer_bot'
    $env:DB_AUTO_INIT = 'true'
    $env:WEBAPP_URL = ''
    $env:WEBHOOK_DOMAIN = ''

    Write-Host ''
    Write-Host "3/3 TAYYOR! Telegram'da @Pizza_kuryer_bot ga /start yozing." -ForegroundColor Green
    Write-Host "Bot ishlab turishi uchun shu oynani YOPMANG. To'xtatish: Ctrl+C yoki oynani yoping."
    Write-Host ''
    & node src/index.js
  } catch {
    Write-Host ''
    Write-Host ('Xato: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Shu oynani rasmga olib yuboring.'
  }
}
