import { env } from '../src/config/env';
import { bulkpePayoutService } from '../src/modules/withdrawals/providers/bulkpe-payout.provider';

async function main() {
  console.log('========================================');
  console.log('       BULKPE INTEGRATION TEST          ');
  console.log('========================================\n');

  console.log('1. Checking Environment Config:');
  console.log(`   PAYOUT_PROVIDER: ${env.PAYOUT_PROVIDER}`);
  console.log(`   BULKPE_BASE_URL: ${env.BULKPE_BASE_URL}`);
  console.log(
    `   BULKPE_API_TOKEN: ${
      env.BULKPE_API_TOKEN
        ? `${env.BULKPE_API_TOKEN.slice(0, 6)}...${env.BULKPE_API_TOKEN.slice(-4)} (Configured)`
        : 'NOT SET'
    }`
  );
  console.log(
    `   BULKPE_WEBHOOK_SECRET: ${
      env.BULKPE_WEBHOOK_SECRET ? 'Configured' : 'Not configured (optional)'
    }\n`
  );

  if (!env.BULKPE_API_TOKEN) {
    console.error('❌ BULKPE_API_TOKEN is missing in your .env file.');
    process.exit(1);
  }

  console.log('2. Testing Bulkpe Balance API (/client/fetchBalance)...');
  try {
    const rawResponse = await fetch(
      `${(env.BULKPE_BASE_URL || 'https://api.bulkpe.in').replace(/\/+$/, '')}/client/fetchBalance`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.BULKPE_API_TOKEN.trim()}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await rawResponse.json();
    console.log(`   HTTP Status: ${rawResponse.status}`);
    console.log(`   API Response: ${JSON.stringify(data, null, 2)}\n`);

    if (rawResponse.ok && (data as { status?: boolean }).status !== false) {
      console.log('✅ Bulkpe Authentication & IP Whitelisting SUCCESSFUL!');
      const balance = await bulkpePayoutService.getAccountBalance();
      console.log(`   Parsed Balance: ₹${balance.balance}`);
    } else {
      console.error('❌ Bulkpe API responded with an error.');
      const msg = (data as { message?: string }).message || '';
      if (msg.toLowerCase().includes('access') || rawResponse.status === 403) {
        console.error(
          '👉 Note: If this mentions access restriction, your server IP might need to be whitelisted in Bulkpe Dashboard -> Settings -> Developer Controls.'
        );
      }
    }
  } catch (err) {
    console.error('❌ Failed to connect to Bulkpe API:', err);
  }

  console.log('\n========================================');
}

main().catch(console.error);

