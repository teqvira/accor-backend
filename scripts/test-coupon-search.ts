/**
 * Unit tests for Coupon / QR Batch Search & Filtering.
 * Run: npx tsx scripts/test-coupon-search.ts
 */
import { listBatchesQuerySchema } from '../src/modules/qr/qr.validator';
import { buildBatchWhereClause } from '../src/modules/qr/repositories/qr-batch.repository';

let failed = 0;
let passed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (!condition) {
    failed++;
    console.error(`FAIL: ${testName}${details ? ` - ${details}` : ''}`);
  } else {
    passed++;
    console.log(`PASS: ${testName}`);
  }
}

// ==========================================
// 1. Validator Tests
// ==========================================
console.log('--- Testing listBatchesQuerySchema Validator ---');

const emptyResult = listBatchesQuerySchema.safeParse({});
assert(emptyResult.success, 'Empty query passes validation');
if (emptyResult.success) {
  assert(emptyResult.data.search === undefined, 'Empty search is undefined');
  assert(emptyResult.data.status === undefined, 'Empty status is undefined');
}

const trimmedSearch = listBatchesQuerySchema.safeParse({ search: '  Diwali Offer  ' });
assert(trimmedSearch.success, 'Valid search passes');
if (trimmedSearch.success) {
  assert(trimmedSearch.data.search === 'Diwali Offer', 'Search string is trimmed');
}

const whitespaceSearch = listBatchesQuerySchema.safeParse({ search: '   ' });
assert(whitespaceSearch.success, 'Whitespace search treated as empty');
if (whitespaceSearch.success) {
  assert(whitespaceSearch.data.search === undefined, 'Whitespace search becomes undefined');
}

const paginationResult = listBatchesQuerySchema.safeParse({ page: '2', limit: '50' });
assert(paginationResult.success, 'String page and limit are coerced to numbers');
if (paginationResult.success) {
  assert(paginationResult.data.page === 2, 'Page coerced to 2');
  assert(paginationResult.data.limit === 50, 'Limit coerced to 50');
}

const invalidLimitResult = listBatchesQuerySchema.safeParse({ limit: '500' });
assert(!invalidLimitResult.success, 'Limit > 100 fails validation');

const validStatuses = ['active', 'inactive', 'draft', 'generated', 'all'];
for (const status of validStatuses) {
  const res = listBatchesQuerySchema.safeParse({ status });
  assert(res.success && res.data.status === status, `Status "${status}" is valid`);
}

const invalidStatusResult = listBatchesQuerySchema.safeParse({ status: 'invalid_status' });
assert(!invalidStatusResult.success, 'Invalid status enum fails validation');


// ==========================================
// 2. Where Clause Builder Tests
// ==========================================
console.log('\n--- Testing buildBatchWhereClause ---');

const noFilters = buildBatchWhereClause({});
assert(noFilters.clause === '', 'No filters produces empty WHERE clause');
assert(noFilters.values.length === 0, 'No filters produces empty values');

const searchOnly = buildBatchWhereClause({ search: 'BATCH-001' });
assert(
  searchOnly.clause.includes('WHERE (b.coupon_name ILIKE $1 OR b.name ILIKE $1 OR b.id::text ILIKE $1 OR p.sku_code ILIKE $1 OR p.name ILIKE $1)'),
  'Search creates full multi-column ILIKE clause'
);
assert(searchOnly.values[0] === '%BATCH-001%', 'Search value wrapped in wildcards');
assert(searchOnly.values.length === 1, 'Search values has 1 entry');

const activeOnly = buildBatchWhereClause({ status: 'active' });
assert(activeOnly.clause === 'WHERE b.active = true', 'Active status produces WHERE b.active = true');
assert(activeOnly.values.length === 0, 'Active boolean does not consume parameter index');

const inactiveOnly = buildBatchWhereClause({ status: 'inactive' });
assert(inactiveOnly.clause === 'WHERE b.active = false', 'Inactive status produces WHERE b.active = false');

const draftOnly = buildBatchWhereClause({ status: 'draft' });
assert(draftOnly.clause === 'WHERE b.status = $1', 'Draft status produces parameterized WHERE b.status = $1');
assert(draftOnly.values[0] === 'draft', 'Draft value is passed in values');

const allStatus = buildBatchWhereClause({ status: 'all' });
assert(allStatus.clause === '', 'Status "all" produces empty clause');

const combined = buildBatchWhereClause({ search: 'Engine Oil', status: 'active' });
assert(
  combined.clause.includes('WHERE (b.coupon_name ILIKE $1 OR b.name ILIKE $1 OR b.id::text ILIKE $1 OR p.sku_code ILIKE $1 OR p.name ILIKE $1) AND b.active = true'),
  'Combined search + status active produces valid WHERE clause'
);
assert(combined.values[0] === '%Engine Oil%', 'Combined search has wildcard parameter');

// Summary
console.log(`\n==========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log(`All coupon search tests passed successfully.`);

