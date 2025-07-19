#!/bin/bash

echo "🚀 Supabase Messages Table Migration"
echo "====================================="
echo echo "Since youre using Supabase Cloud, you need to run this migration manually.
echo
echo "📋 Steps to run the migration:"
echo 1. Go to your Supabase Dashboard: https://supabase.com/dashboard"
echo "2. Select your project"
echo "3. Go to SQL Editor (in the left sidebar)"
echo 4.Copy and paste the SQL below
echo 5. Click 'Run' to execute the migration
echo ""
echo ⚠️WARNING: This will DROP your existing messages table and recreate it!"
echoMake sure you have backed up any important data.
echo cho📝 SQL to run:"
echo "====================================="

cat database/messages_rls.sql

echo ""
echo "====================================="
echo "✅ After running the migration:"
echo "   - Your chat functionality should work without 400errors"
echo    - RLS policies will be in place for security"
echo    - Test sending messages in your app
echo ho "🔗 If you need help, check the Supabase documentation:"
echo "   https://supabase.com/docs/guides/database/migrations" 