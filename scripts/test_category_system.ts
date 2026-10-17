import {
  getCategoryIcon,
  getCategoryTheme,
  estimateCategoryBudget,
  computeCategoryDetails,
} from '../src/services/categoryService';
import { Transaction } from '../src/types/financial';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('--- Testing getCategoryIcon ---');
assert(getCategoryIcon('Food & Groceries') === 'restaurant', 'Food icon is restaurant');
assert(getCategoryIcon('Transportation') === 'directions_subway', 'Transportation icon is directions_subway');
assert(getCategoryIcon('Utility & Fixed Costs') === 'bolt', 'Utility icon is bolt');
assert(getCategoryIcon('Shopping & Gadgets') === 'shopping_bag', 'Shopping icon is shopping_bag');
assert(getCategoryIcon('Cash-out & Bank Fees') === 'price_change', 'Cashout icon is price_change');
assert(getCategoryIcon('Entertainment & Others') === 'movie', 'Entertainment icon is movie');

// Custom categories
assert(getCategoryIcon('Health') === 'health_and_safety', 'Health icon is health_and_safety');
assert(getCategoryIcon('Electricity') === 'bolt', 'Electricity icon is bolt');
assert(getCategoryIcon('Medicine') === 'medical_services', 'Medicine icon is medical_services');
assert(getCategoryIcon('Education') === 'school', 'Education icon is school');
assert(getCategoryIcon('Gym & Fitness') === 'fitness_center', 'Gym icon is fitness_center');
assert(getCategoryIcon('Pet Care') === 'pets', 'Pets icon is pets');
assert(getCategoryIcon('Travel & Vacation') === 'flight', 'Travel icon is flight');
assert(getCategoryIcon('Something Completely Custom') === 'category', 'Fallback icon is category');

// Bengali categories
assert(getCategoryIcon('খাবার ও মুদি') === 'restaurant', 'Bengali food icon is restaurant');
assert(getCategoryIcon('চিকিৎসা ও ওষুধ') === 'medical_services', 'Bengali medical icon is medical_services');
assert(getCategoryIcon('শিক্ষা') === 'school', 'Bengali education icon is school');

console.log('\n--- Testing computeCategoryDetails ---');

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    date: '2026-10-05',
    type: 'expense',
    category: 'Transportation',
    amount: 350,
    merchant: 'Uber Bangladesh',
    description: 'Uber ride from Banani to Dhanmondi',
    account: 'bKash',
    paymentMethod: 'bKash App',
    classification: 'essential',
  },
  {
    id: 'tx-2',
    date: '2026-10-12',
    type: 'expense',
    category: 'transportation', // test case-insensitivity
    amount: 150,
    merchant: 'Pathao Rides',
    description: 'Pathao bike to Gulshan',
    account: 'Nagad',
    paymentMethod: 'Nagad QR',
    classification: 'essential',
  },
  {
    id: 'tx-3',
    date: '2026-09-10',
    type: 'expense',
    category: 'Transportation',
    amount: 400,
    merchant: 'Uber Bangladesh',
    description: 'Uber ride to Uttara',
    account: 'bKash',
    paymentMethod: 'bKash App',
    classification: 'essential',
  },
  {
    id: 'tx-4',
    date: '2026-10-01',
    type: 'expense',
    category: 'Food & Groceries',
    amount: 1200,
    merchant: 'Shwapno',
    description: 'Weekly grocery shopping',
    account: 'City Bank',
    paymentMethod: 'Visa Debit',
    classification: 'essential',
  },
];

const transportDetails = computeCategoryDetails(
  mockTransactions,
  'Transportation',
  '2026-10',
  80000
);

assert(transportDetails.categoryName === 'Transportation', 'Category name matches');
assert(transportDetails.totalSpentInMonth === 500, `October spend is 500 (got ${transportDetails.totalSpentInMonth})`);
assert(transportDetails.transactionCountInMonth === 2, `October count is 2 (got ${transportDetails.transactionCountInMonth})`);
assert(transportDetails.totalSpentAllTime === 900, `All time spend is 900 (got ${transportDetails.totalSpentAllTime})`);
assert(transportDetails.transactionCountAllTime === 3, `All time count is 3 (got ${transportDetails.transactionCountAllTime})`);
assert(transportDetails.prevMonthTotal === 400, `September spend is 400 (got ${transportDetails.prevMonthTotal})`);
assert(transportDetails.momDiffAmount === 100, `MoM diff is +100 (got ${transportDetails.momDiffAmount})`);
assert(transportDetails.momChangePercentage === 25, `MoM % is +25% (got ${transportDetails.momChangePercentage}%)`);
assert(transportDetails.averageTransactionInMonth === 250, `Avg in Oct is 250 (got ${transportDetails.averageTransactionInMonth})`);
assert(transportDetails.largestTransactionInMonth?.amount === 350, `Largest tx in Oct is 350 (got ${transportDetails.largestTransactionInMonth?.amount})`);

console.log('\n--- Testing zero transaction category ---');
const emptyDetails = computeCategoryDetails(
  mockTransactions,
  'Pet Care',
  '2026-10',
  80000
);
assert(emptyDetails.totalSpentInMonth === 0, 'Zero spent in empty category');
assert(emptyDetails.transactionCountInMonth === 0, 'Zero count in empty category');
assert(emptyDetails.totalSpentAllTime === 0, 'Zero all time spend');
assert(emptyDetails.largestTransactionInMonth === null, 'Largest tx is null');
assert(emptyDetails.transactionsInMonth.length === 0, 'Zero transactions list');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
