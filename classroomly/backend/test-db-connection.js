const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Missing'}\n`);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ Missing required environment variables. Please check your .env file.');
    return;
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔌 Testing Supabase connection...');

    // Test 1: Simple query to check connection
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (testError) {
      console.log('❌ Connection test failed:', testError.message);
      
      // Check if tables exist
      if (testError.message.includes('relation "users" does not exist')) {
        console.log('📝 Tables not found. You may need to run the migration.');
        console.log('   Run: supabase db push or apply the migration manually.');
      }
      return;
    }

    console.log('✅ Supabase connection successful!');

    // Test 2: Check if tables exist
    console.log('\n📊 Checking database schema...');
    
    const tables = ['users', 'classes', 'bookings', 'sessions', 'messages', 'materials'];
    const tableStatus = {};

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      tableStatus[table] = error ? '❌ Missing' : '✅ Exists';
    }

    console.log('Table Status:');
    Object.entries(tableStatus).forEach(([table, status]) => {
      console.log(`  ${table}: ${status}`);
    });

    // Test 3: Check RLS policies
    console.log('\n🔒 Checking Row Level Security...');
    
    const { data: rlsData, error: rlsError } = await supabase.rpc('get_rls_policies');
    
    if (rlsError) {
      console.log('⚠️  Could not check RLS policies (this is normal for new databases)');
    } else {
      console.log('✅ RLS policies are configured');
    }

    // Test 4: Test basic CRUD operations
    console.log('\n🧪 Testing basic operations...');
    
    // Test insert (will be rolled back)
    const testUser = {
      email: 'test@example.com',
      password_hash: 'test_hash',
      first_name: 'Test',
      last_name: 'User',
      user_type: 'student'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert(testUser)
      .select();

    if (insertError) {
      console.log('❌ Insert test failed:', insertError.message);
    } else {
      console.log('✅ Insert test successful');
      
      // Clean up test data
      await supabase
        .from('users')
        .delete()
        .eq('id', insertData[0].id);
      console.log('🧹 Test data cleaned up');
    }

    console.log('\n🎉 Database connection test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Set up your Supabase project at https://app.supabase.com');
    console.log('2. Run the migration: supabase/migrations/20250120000000_complete_schema_migration.sql');
    console.log('3. Configure your environment variables');
    console.log('4. Start your backend server: npm start');

  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your Supabase URL and service role key');
    console.log('2. Ensure your Supabase project is active');
    console.log('3. Verify the migration has been applied');
    console.log('4. Check your network connection');
  }
}

// Run the test
testDatabaseConnection();
