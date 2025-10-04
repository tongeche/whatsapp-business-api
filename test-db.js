// Quick test to connect to your Supabase database locally
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

console.log('Environment check:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Found' : 'Missing');
console.log('VITE_SUPABASE_SERVICE_ROLE_KEY:', process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'Found' : 'Missing');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    console.log('🔗 Testing Supabase connection...');
    
    // Test basic connection
    const { data, error } = await supabase.from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .limit(10);
    
    if (error) {
      console.log('❌ Could not get tables:', error.message);
      
      // Try alternative approach - test with a simple query
      const { data: testData, error: testError } = await supabase
        .from('users') // Common table name
        .select('*')
        .limit(1);
      
      if (testError) {
        console.log('❌ Connection test failed:', testError.message);
        
        // Let's try to see what tables exist by trying common names
        const commonTables = ['users', 'customers', 'orders', 'messages', 'contacts', 'leads', 'organizations', 'accounts'];
        console.log('\n🔍 Testing common table names...');
        
        for (const tableName of commonTables) {
          try {
            const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .limit(1);
            
            if (!error) {
              console.log(`✅ Found table: ${tableName}`);
              if (data && data.length > 0) {
                console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
              }
            }
          } catch (e) {
            // Table doesn't exist, continue
          }
        }
      } else {
        console.log('✅ Connection successful via users table');
        if (testData && testData.length > 0) {
          console.log('Sample data:', testData[0]);
        }
      }
    } else {
      console.log('✅ Connection successful! Found tables:');
      data.forEach(table => console.log(`  - ${table.tablename}`));
    }
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
  }
}

testConnection();