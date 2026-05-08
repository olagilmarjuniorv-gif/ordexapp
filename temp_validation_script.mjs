
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import ws from 'ws';

// --- Configuration ---
const SUPABASE_URL = 'https://wpugchtkjbhfprhqhooz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NHl_1UXBygwNyH4K25KEug_Ytu44Oou';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables.');
    process.exit(1);
}

// --- Test Setup ---
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { 
        autoRefreshToken: false,
        persistSession: false
    },
    realtime: { transport: ws },
});

const testId = uuidv4().split('-')[0];
const userEmail = `test-user-${testId}@test.com`; // Changed domain to test.com
const userPassword = `password-${testId}`;
let testUser = null;

const log = (status, message, data = '') => {
  console.log(`[${status}] ${message}`, data);
};

// --- Test Functions ---

async function testConnection() {
    log('RUNNING', 'Testing Supabase connection...');
    const { error } = await supabase.from('companies').select('id').limit(1);
    if (error && error.code !== '42P01' && !error.message.includes('Unauthorized')) {
        log('FAIL', 'Supabase connection failed with an unexpected error:', error);
        throw new Error('Connection test failed.');
    }
    log('PASS', 'Supabase connection successful (or blocked by RLS, which is expected).');
}

async function testAuth() {
    log('RUNNING', 'Testing authentication (sign-up)...');
    const { data, error } = await supabase.auth.signUp({
        email: userEmail,
        password: userPassword,
    });

    if (error) {
        log('FAIL', 'User sign-up failed:', error);
        throw new Error('Auth test failed on sign-up.');
    }
    
    if (!data.user) {
        log('FAIL', 'User sign-up did not return a user.', data);
        throw new Error('Auth test failed on sign-up.');
    }

    testUser = data.user;
    log('PASS', 'User sign-up successful.', { userId: testUser.id });
}

// --- Main Execution ---
(async () => {
    try {
        await testConnection();
        await testAuth();
        log('SUCCESS', 'All validation tests passed!');
        log('INFO', `A test user with email ${userEmail} was created and NOT deleted.`);
    } catch (error) {
        log('ERROR', 'A critical error occurred during validation:', error.message);
        process.exit(1);
    }
})();
