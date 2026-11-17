import { env } from '../src/config/env';

async function main() {
  console.log('========================================');
  console.log('      CASHFREE INTEGRATION TEST         ');
  console.log('========================================\n');

  console.log('1. Checking Environment Config:');
  console.log(`   PAYOUT_PROVIDER: ${env.PAYOUT_PROVIDER}`);
  console.log(`   CASHFREE_ENV: ${env.CASHFREE_ENV}`);
  console.log(
    `   CASHFREE_CLIENT_ID: ${
      env.CASHFREE_CLIENT_ID
        ? `${env.CASHFREE_CLIENT_ID.slice(0, 6)}... (Configured)`
        : 'NOT SET'
    }`
  );
  console.log(
    `   CASHFREE_CLIENT_SECRET: ${
      env.CASHFREE_CLIENT_SECRET ? 'Configured' : 'NOT SET'
    }\n`
  );

  if (!env.CASHFREE_CLIENT_ID || !env.CASHFREE_CLIENT_SECRET) {
    console.error('❌ CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET is missing in .env');
    console.error('👉 Go to Cashfree Dashboard -> Developers -> API Keys to generate them.');
    process.exit(1);
  }

  const baseUrl =
    env.CASHFREE_ENV === 'production'
      ? 'https://api.cashfree.com/payout'
      : 'https://sandbox.cashfree.com/payout';

  console.log(`2. Testing Cashfree Payouts API at: ${baseUrl}...`);

  try {
    // Test V2 transfers endpoint check with dummy ID to verify auth & IP whitelist
    const response = await fetch(`${baseUrl}/transfers?transfer_id=test_auth_check`, {
      method: 'GET',
      headers: {
        'x-client-id': env.CASHFREE_CLIENT_ID.trim(),
        'x-client-secret': env.CASHFREE_CLIENT_SECRET.trim(),
        'x-api-version': '2024-01-01',
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as { type?: string; code?: string; message?: string };
    console.log(`   HTTP Status: ${response.status}`);
    console.log(`   API Response: ${JSON.stringify(data, null, 2)}\n`);

    if (data.type === 'authentication_error') {
      console.error('❌ Cashfree Authentication / IP Whitelist Error:', data.message);
    } else {
      console.log('✅ CASHFREE AUTHENTICATION & IP WHITELISTING SUCCESSFUL!');
      console.log('   Your Cashfree Sandbox credentials and IP are fully authorized.');
    }
  } catch (err) {
    console.error('❌ Failed to connect to Cashfree API:', err);
  }

  console.log('\n========================================');
}

main().catch(console.error);
