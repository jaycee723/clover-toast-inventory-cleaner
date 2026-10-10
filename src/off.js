'use strict';

export async function lookupOpenFoodFacts({ barcode, fetchImpl = fetch, cache, signal }) {
  if (!fetchImpl) return { status: 'unavailable', message: 'Fetch unavailable in current environment.' };
  if (!barcode) return { status: 'not-found' };
  if (cache?.has(barcode)) return cache.get(barcode);
  let response;
  try {
    response = await fetchImpl(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`, {
      method: 'GET',
      mode: 'cors',
      signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') return { status: 'pending', message: 'Lookup cancelled.' };
    return { status: 'error', message: error?.message || 'Network error' };
  }
  if (!response.ok) {
    const result = { status: 'error', message: `HTTP ${response.status}` };
    cache?.set(barcode, result);
    return result;
  }
  const data = await response.json();
  const result = data?.product
    ? {
      status: 'found',
      suggestion: {
        product_name: data.product.product_name || '',
        brand: data.product.brands || '',
        source_type: 'open_food_facts',
        source_url: `https://world.openfoodfacts.org/product/${barcode}`
      }
    }
    : { status: 'not-found' };
  cache?.set(barcode, result);
  return result;
}
