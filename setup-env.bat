@echo off
echo Setting up environment configuration...

if not exist "backend\.env" (
    echo Creating backend\.env from .env.example...
    copy "backend\.env.example" "backend\.env"
    echo.
    echo ⚠️  IMPORTANT: Edit backend\.env and add your Plaid API credentials!
    echo    Get them from https://dashboard.plaid.com/
    echo.
) else (
    echo backend\.env already exists.
)

echo Environment setup complete!
echo.
echo Next steps:
echo 1. Edit backend\.env with your Plaid credentials
echo 2. Run quick-setup.bat to install dependencies
echo 3. Run start-backend.bat and start-frontend.bat
pause