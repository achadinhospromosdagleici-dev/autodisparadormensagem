import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

console.log("Supabase URL:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Checking if wuzapi_settings table exists...");
try {
  const { data, error } = await supabase
    .from('wuzapi_settings')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error querying wuzapi_settings:", error);
  } else {
    console.log("Successfully queried wuzapi_settings. Result:", data);
  }
} catch (e) {
  console.error("Exception querying wuzapi_settings:", e);
}

console.log("Checking if wuzapi_instances table exists...");
try {
  const { data: instData, error: instErr } = await supabase
    .from('wuzapi_instances')
    .select('*')
    .limit(1);

  if (instErr) {
    console.error("Error querying wuzapi_instances:", instErr);
  } else {
    console.log("Successfully queried wuzapi_instances. Result:", instData);
  }
} catch (e) {
  console.error("Exception querying wuzapi_instances:", e);
}
