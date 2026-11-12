import React, { useState, useMemo } from 'react';
import { formatTagPrice } from './avery_labels.js';

interface MasterInventoryViewProps {
  items: any[];
  brandLogos: any[];
  onSaveItem: (item: any) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onOpenAveryWithItems: (selectedItems?: any[]) => void;
  onSwitchToWizard: () => void;
  statusMessage?: string;
}

export const MasterInventoryView: React.FC<MasterInventoryViewProps> = ({
  items,
  brandLogos,
  onSaveItem,
  onDeleteItem,
  onOpenAveryWithItems,
  onSwitchToWizard,
  statusMessage
}) => {
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price_asc' | 'price_desc' | 'updated'>('name');

  // Edit/Add modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [activeItem, setActiveItem] = useState<any>({
    barcode: '',
    name: '',
    category: 'Spirits',
    price: '0.00',
    size: '',
    brand: '',
    sku: '',
    notes: ''
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Derived filter options
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [items]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.brand) set.add(i.brand);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((i) => {
        if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
        if (brandFilter !== 'all' && i.brand !== brandFilter) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const inName = (i.name || '').toLowerCase().includes(q);
          const inBarcode = (i.barcode || '').toLowerCase().includes(q);
          const inBrand = (i.brand || '').toLowerCase().includes(q);
          const inSku = (i.sku || '').toLowerCase().includes(q);
          if (!inName && !inBarcode && !inBrand && !inSku) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') {
          return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
        }
        if (sortBy === 'price_desc') {
          return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
        }
        if (sortBy === 'updated') {
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        }
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [items, categoryFilter, brandFilter, search, sortBy]);

  const handleOpenAdd = () => {
    setModalMode('add');
    setActiveItem({
      barcode: '',
      name: '',
      category: categories[0] || 'Spirits',
      price: '0.00',
      size: '',
      brand: '',
      sku: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setModalMode('edit');
    setActiveItem({ ...item });
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem.name?.trim()) {
      alert('Item name is required');
      return;
    }
    setIsSaving(true);
    try {
      await onSaveItem(activeItem);
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Error saving item: ${err.message || String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="wizard-pane" style={{ padding: 0 }}>
      {/* Top Banner & Metrics */}
      <div style={{ padding: '20px 24px', background: '#0b1120', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>📦</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: '#f8fafc', fontWeight: 600 }}>
                  Master Inventory Database
                </h2>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 3 }}>
                  Your permanent store catalog. View, search, and edit individual items at any time.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-toast btn-sm"
              style={{ background: '#7c3aed', color: '#ffffff' }}
              onClick={() => onOpenAveryWithItems(filteredItems)}
              title="Open Avery Price Tag Studio for Master Inventory"
            >
              🏷️ Print Price Tags (Avery)
            </button>
            <button
              type="button"
              className="btn-toast btn-sm"
              style={{ background: '#059669', color: '#ffffff' }}
              onClick={handleOpenAdd}
            >
              ➕ Add New Item
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={onSwitchToWizard}
            >
              ⚡ Import Clover File
            </button>
          </div>
        </div>

        {/* Metric Badges */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ background: '#1e293b', padding: '8px 14px', borderRadius: 6, border: '1px solid #334155' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>TOTAL ITEMS</span>
            <strong style={{ fontSize: 16, color: '#f8fafc' }}>{items.length}</strong>
          </div>
          <div style={{ background: '#1e293b', padding: '8px 14px', borderRadius: 6, border: '1px solid #334155' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>CATEGORIES</span>
            <strong style={{ fontSize: 16, color: '#38bdf8' }}>{categories.length}</strong>
          </div>
          <div style={{ background: '#1e293b', padding: '8px 14px', borderRadius: 6, border: '1px solid #334155' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>FILTERED MATCHES</span>
            <strong style={{ fontSize: 16, color: '#a78bfa' }}>{filteredItems.length}</strong>
          </div>
          <div style={{ background: '#1e293b', padding: '8px 14px', borderRadius: 6, border: '1px solid #334155' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>BRAND LOGOS HOSTED</span>
            <strong style={{ fontSize: 16, color: '#4ade80' }}>{brandLogos.length}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ padding: '14px 24px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1, minWidth: 300 }}>
          <input
            type="text"
            placeholder="Search master items by name, barcode, brand, or SKU…"
            className="input-field"
            style={{ minWidth: 260, flex: 1, padding: '7px 12px', fontSize: 13 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="input-field"
            style={{ width: 160, padding: '7px 10px', fontSize: 13 }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories ({items.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {brands.length > 0 && (
            <select
              className="input-field"
              style={{ width: 160, padding: '7px 10px', fontSize: 13 }}
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <option value="all">All Brands ({brands.length})</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}

          <select
            className="input-field"
            style={{ width: 150, padding: '7px 10px', fontSize: 13 }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="name">Sort: Name (A-Z)</option>
            <option value="price_asc">Sort: Price (Low to High)</option>
            <option value="price_desc">Sort: Price (High to Low)</option>
            <option value="updated">Sort: Recently Updated</option>
          </select>
        </div>

        {statusMessage && (
          <div style={{ fontSize: 12, color: '#38bdf8' }}>
            {statusMessage}
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', background: '#090d16', minHeight: 400 }}>
        <table className="review-table" style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#cbd5e1' }}>
              <th style={{ width: 140 }}>Barcode / UPC</th>
              <th>Item Name</th>
              <th style={{ width: 160 }}>Category</th>
              <th style={{ width: 130 }}>Brand</th>
              <th style={{ width: 90 }}>Price</th>
              <th style={{ width: 80 }}>Size</th>
              <th style={{ width: 130, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                  {items.length === 0 ? (
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: '#f8fafc' }}>
                        Master Inventory Database is Empty
                      </div>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4, marginBottom: 16 }}>
                        Import and clean a Clover inventory file, or add your first item manually.
                      </div>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn-toast btn-sm"
                          style={{ background: '#059669' }}
                          onClick={handleOpenAdd}
                        >
                          ➕ Add Item Manually
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={onSwitchToWizard}
                        >
                          ⚡ Go to Import Wizard
                        </button>
                      </div>
                    </div>
                  ) : (
                    'No items match the current search or category filter.'
                  )}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td>
                    <span style={{ fontFamily: 'monospace', color: '#e2e8f0', fontWeight: 500 }}>
                      {item.barcode || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#f8fafc' }}>
                      {item.name}
                    </div>
                    {item.notes && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {item.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ color: '#cbd5e1' }}>
                      {item.category || 'General'}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: '#94a3b8' }}>
                      {item.brand || '—'}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#38bdf8' }}>
                      {formatTagPrice(item.price)}
                    </strong>
                  </td>
                  <td>
                    <span style={{ color: '#94a3b8' }}>
                      {item.size || '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => handleOpenEdit(item)}
                        title="Edit Item"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => onOpenAveryWithItems([item])}
                        title="Print Avery Price Tag for this item"
                      >
                        🏷️ Tag
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: 11, color: '#f87171', borderColor: '#7f1d1d' }}
                        onClick={() => {
                          if (window.confirm(`Delete "${item.name}" from master inventory?`)) {
                            onDeleteItem(item.id);
                          }
                        }}
                        title="Delete Item"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Add Item Modal */}
      {isModalOpen && (
        <div
          className="avery-modal-overlay"
          style={{ zIndex: 1300 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="master-item-modal-heading"
        >
          <div className="avery-modal-container" style={{ maxWidth: 560, height: 'auto', maxHeight: '90vh' }}>
            <form onSubmit={handleSaveModal}>
              <div className="avery-header">
                <div className="avery-header-title">
                  <span style={{ fontSize: 20 }}>{modalMode === 'add' ? '➕' : '✏️'}</span>
                  <h3 id="master-item-modal-heading" style={{ margin: 0, fontSize: 16 }}>
                    {modalMode === 'add' ? 'Add Master Inventory Item' : `Edit Item: ${activeItem.name}`}
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                    Item Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. Jack Daniel's Tennessee Whiskey"
                    value={activeItem.name || ''}
                    onChange={(e) => setActiveItem({ ...activeItem, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                      Category <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      list="master-category-suggestions"
                      className="input-field"
                      placeholder="e.g. Spirits, Wine, Beer"
                      value={activeItem.category || ''}
                      onChange={(e) => setActiveItem({ ...activeItem, category: e.target.value })}
                    />
                    <datalist id="master-category-suggestions">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                      <option value="Spirits" />
                      <option value="Wine" />
                      <option value="Beer" />
                      <option value="Liqueur" />
                      <option value="Ready-to-Drink (RTD)" />
                      <option value="Tobacco" />
                      <option value="Snacks &amp; Grocery" />
                    </datalist>
                  </div>

                  <div>
                    <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                      Barcode / UPC
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 082184090466"
                      value={activeItem.barcode || ''}
                      onChange={(e) => setActiveItem({ ...activeItem, barcode: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                      Price (USD) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="e.g. 29.99"
                      value={activeItem.price || '0.00'}
                      onChange={(e) => setActiveItem({ ...activeItem, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                      Size / Unit
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 750ml, 1.75L"
                      value={activeItem.size || ''}
                      onChange={(e) => setActiveItem({ ...activeItem, size: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                      Brand
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Jack Daniel's"
                      value={activeItem.brand || ''}
                      onChange={(e) => setActiveItem({ ...activeItem, brand: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                    Notes / Location / SKU:
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Shelf location, distributor notes, or SKU"
                    value={activeItem.notes || ''}
                    onChange={(e) => setActiveItem({ ...activeItem, notes: e.target.value })}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '14px 20px',
                  background: '#0b1120',
                  borderTop: '1px solid #334155',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10
                }}
              >
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-toast btn-sm"
                  style={{ background: '#059669', color: '#ffffff' }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save to Master Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
