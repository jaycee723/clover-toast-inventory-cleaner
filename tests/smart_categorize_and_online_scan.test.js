import test from 'node:test';
import assert from 'node:assert/strict';
import { isGenericCategory, smartCategorizeInventory, GENERIC_CATEGORIES } from '../src/categories.js';
import { applySingleAiChange, revertSingleAiChange } from '../src/ai_assistant.js';
import { isApproved } from '../src/review.js';

test('isGenericCategory correctly identifies missing and generic retail categories', () => {
  assert.equal(isGenericCategory(''), true);
  assert.equal(isGenericCategory(null), true);
  assert.equal(isGenericCategory('General Retail'), true);
  assert.equal(isGenericCategory('general'), true);
  assert.equal(isGenericCategory('RETAIL'), true);
  assert.equal(isGenericCategory('Uncategorized'), true);
  assert.equal(isGenericCategory('Misc'), true);
  assert.equal(isGenericCategory('Miscellaneous'), true);
  assert.equal(isGenericCategory('no barcode'), true); // in NON_PRODUCT
  assert.equal(isGenericCategory('bottle/can tax'), true); // in NON_PRODUCT

  // Valid, specific categories should not be generic
  assert.equal(isGenericCategory('BEER'), false);
  assert.equal(isGenericCategory('LIQUOR/SPIRITS'), false);
  assert.equal(isGenericCategory('Spirits - Vodka'), false);
  assert.equal(isGenericCategory('Craft Beer - IPA'), false);
  assert.equal(isGenericCategory('WINE'), false);
  assert.equal(isGenericCategory('CANDY/SNACKS'), false);
});

test('smartCategorizeInventory learns mappings from existing catalog items and infers categories for generic items', () => {
  const rows = [
    // Existing categorized items
    {
      id: 'r1',
      current_name: "Tito's Handmade Vodka 750 mL",
      brand: "Tito's",
      category: 'Spirits - Vodka',
      decisions: { category: 'accept' }
    },
    {
      id: 'r2',
      current_name: 'Corona Extra 12-Pack Cans',
      brand: 'Corona',
      category: 'Beer - Imports',
      decisions: { category: 'accept' }
    },
    {
      id: 'r3',
      current_name: 'Marlboro Red 100s Box',
      brand: 'Marlboro',
      category: 'TOBACCO PRODUCTS',
      decisions: { category: 'accept' }
    },
    // Generic or missing items that should be smart-categorized
    {
      id: 'r4',
      current_name: "Tito's Handmade Vodka 1.75 L",
      brand: "Tito's",
      category: 'General Retail', // generic!
      decisions: { category: 'pending' }
    },
    {
      id: 'r5',
      current_name: 'Corona Light 6pk Bottles',
      brand: 'Corona',
      category: '', // missing!
      decisions: { category: 'pending' }
    },
    {
      id: 'r6',
      current_name: 'Marlboro Gold 100s',
      brand: '',
      category: 'Uncategorized', // generic!
      decisions: { category: 'pending' }
    }
  ];

  const result = smartCategorizeInventory(rows, { autoApply: true });

  assert.equal(result.improvedCount, 3);
  assert.equal(rows[3].category, 'Spirits - Vodka');
  assert.equal(rows[3].decisions.category, 'accept');

  assert.equal(rows[4].category, 'Beer - Imports');
  assert.equal(rows[4].decisions.category, 'accept');

  assert.equal(rows[5].category, 'TOBACCO PRODUCTS');
  assert.equal(rows[5].decisions.category, 'accept');
});

test('smartCategorizeInventory falls back to domain rules if no catalog match exists', () => {
  const rows = [
    {
      id: 'r1',
      current_name: 'Jameson Irish Whiskey 750 mL',
      category: 'General Retail',
      decisions: { category: 'pending' }
    },
    {
      id: 'r2',
      current_name: 'Cheetos Puffs Crunchy 8 oz',
      category: '',
      decisions: { category: 'pending' }
    }
  ];

  const result = smartCategorizeInventory(rows, { autoApply: true });

  assert.equal(result.improvedCount, 2);
  assert.equal(rows[0].category, 'LIQUOR/SPIRITS');
  assert.equal(rows[1].category, 'CANDY/SNACKS');
});

test('applySingleAiChange applies change to individual item and revertSingleAiChange restores it individually', () => {
  const records = [
    { id: '1', name: 'CORONA EXTRA 12PK', barcode: '080660956152', category: 'General', price: '18.99' },
    { id: '2', name: 'TITOS VODKA 750ML', barcode: '619947000020', category: 'General', price: '21.99' }
  ];

  const rows = [
    {
      id: 'r1',
      current_name: 'CORONA EXTRA 12PK',
      barcode: { original: '080660956152' },
      category: 'General',
      price: '18.99',
      decisions: { name: 'pending', category: 'pending', barcode: 'pending' }
    },
    {
      id: 'r2',
      current_name: 'TITOS VODKA 750ML',
      barcode: { original: '619947000020' },
      category: 'General',
      price: '21.99',
      decisions: { name: 'pending', category: 'pending', barcode: 'pending' }
    }
  ];

  // Apply change ONLY to item r1
  const changeR1 = {
    id: 'r1',
    field: 'name',
    originalValue: 'CORONA EXTRA 12PK',
    proposedValue: 'Corona Extra 12-Pack',
    reason: 'Standardized casing and packaging'
  };

  const applyRes = applySingleAiChange(records, rows, changeR1);
  assert.equal(applyRes.success, true);
  assert.ok(applyRes.undoRecord);

  // Check item r1 was updated
  assert.equal(rows[0].current_name, 'Corona Extra 12-Pack');
  assert.equal(records[0].name, 'Corona Extra 12-Pack');
  assert.equal(rows[0].geminiCorrected, true);

  // Check item r2 remains untouched!
  assert.equal(rows[1].current_name, 'TITOS VODKA 750ML');
  assert.equal(records[1].name, 'TITOS VODKA 750ML');

  // Revert/undo change for item r1
  const revertSuccess = revertSingleAiChange(records, rows, applyRes.undoRecord);
  assert.equal(revertSuccess, true);

  // Check item r1 was restored back to original value
  assert.equal(rows[0].current_name, 'CORONA EXTRA 12PK');
  assert.equal(records[0].name, 'CORONA EXTRA 12PK');
  assert.equal(rows[0].geminiCorrected, false);
});
