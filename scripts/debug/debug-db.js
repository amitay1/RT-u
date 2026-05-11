// Debug script to test database insert
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: 'postgresql://scanmaster:scanmaster_dev_password@localhost:5433/scanmaster'
});

async function test() {
  try {
    // Test simple connection
    const res1 = await pool.query('SELECT NOW()');
    console.log('✅ Connection OK, time:', res1.rows[0].now);
    
    // Test insert with JSON
    const testData = { test: 'hello', nested: { value: 123 } };
    const res2 = await pool.query(
      `INSERT INTO technique_sheets (user_id, org_id, sheet_name, standard, data, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        '00000000-0000-0000-0000-000000000000',
        '11111111-1111-1111-1111-111111111111',
        'Debug Test Sheet',
        'AMS-STD-2154E',
        JSON.stringify(testData),
        'draft'
      ]
    );
    console.log('✅ Insert OK, id:', res2.rows[0].id);
    
    // Clean up
    await pool.query('DELETE FROM technique_sheets WHERE sheet_name = $1', ['Debug Test Sheet']);
    console.log('✅ Cleanup OK');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('   Code:', err.code);
    console.error('   Detail:', err.detail);
  } finally {
    await pool.end();
  }
}

test();
