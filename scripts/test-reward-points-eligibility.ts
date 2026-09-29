/**
 * Unit checks for garage owner / worker / dealer reward-points eligibility.
 * Run: npx tsx scripts/test-reward-points-eligibility.ts
 */
import { isRewardPointsEligible } from '../src/modules/auth/user.types';

type Case = {
  name: string;
  user: { userType?: 'mechanic' | 'dealer'; garageRole?: 'owner' | 'worker' };
  expected: boolean;
};

const cases: Case[] = [
  {
    name: 'garage owner earns/redeems points',
    user: { userType: 'mechanic', garageRole: 'owner' },
    expected: true,
  },
  {
    name: 'mechanic without garageRole treated as eligible (owner-like)',
    user: { userType: 'mechanic' },
    expected: true,
  },
  {
    name: 'garage worker is cash-only (points go to owner)',
    user: { userType: 'mechanic', garageRole: 'worker' },
    expected: false,
  },
  {
    name: 'dealer is points eligible',
    user: { userType: 'dealer' },
    expected: true,
  },
  {
    name: 'unknown user type is not eligible',
    user: {},
    expected: false,
  },
];

let failed = 0;
for (const c of cases) {
  const actual = isRewardPointsEligible(c.user);
  if (actual !== c.expected) {
    failed += 1;
    console.error(`FAIL: ${c.name} — expected ${c.expected}, got ${actual}`);
  } else {
    console.log(`PASS: ${c.name}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${cases.length} failed`);
  process.exit(1);
}

console.log(`\nAll ${cases.length} eligibility checks passed`);
