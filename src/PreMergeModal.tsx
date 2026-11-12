import React, { useState, useMemo } from 'react';
import { formatTagPrice } from './avery_labels.js';

interface PreMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  diffs: any[];
  stats: {
    total: number;
    newCount: number;
    updateCount: number;
    matchCount: number;
  };
  onMergeAll: () => Promise<void>;
  onMergeNewOnly: () => Promise<void>;
  onUpdateDiffItem: (index: number, updatedFields: any) => void;
  isBusy: boolean;
}

export const PreMergeModal: React.FC<PreMergeModalProps> = ({
  isOpen,
  onClose,
  diffs,
  stats,
  onMergeAll,
  onMergeNewOnly,
  onUpdateDiffItem,
  isBusy
}) => {
  const [filter, setFilter] = useState<'all' | 'new' | 'update' | 'match'>('all');
  const [search, setSearch] = useState<string>('');
  const [editingItem, setEditingItem] = useState<{ diffIndex: number; data: any } | null>(null);

  const filteredDiffs = useMemo(() => {
    return diffs.filter((d) => {
      if (filter !== 'all' && d.status !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const inName = (d.incoming?.name || '').toLowerCase().includes(q);
        const inBarcode = (d.incoming?.barcode || '').toLowerCase().includes(q);
        const inCat = (d.incoming?.category || '').toLowerCase().includes(q);
        if (!inName && !inBarcode && !inCat) return false;
      }
      return true;
    });
  }, [diffs, filter, search]);

  const selectedCount = diffs.filter((d) => d.selected).length;

  if (!isOpen) return null;

  return (
    <div
      className="avery-modal-overlay"
      style={{ zIndex: 1200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="premerge-modal-heading"
    >
      <div className="avery-modal-container" style={{ maxWidth: 1100, height: '90vh' }}>
        {/* Header */}
        <div className="avery-header" style={{ borderBottom: '1px solid #334155' }}>
          <div className="avery-header-title">
            <span style={{ fontSize: 26 }}>📥</span>
            <div>
              <h2 id="premerge-modal-heading" style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
                Pre-Merge Import Review &amp; Edit Preview
              </h2>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                Review incoming cleaned items compared against your Master Inventory database before committing.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onClose}
            disabled={isBusy}
          >
            ✕ Close
          </button>
        </div>

        {/* Stats & Filter Bar */}
        <div style={{ padding: '12px 20px', background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn-sm ${filter === 'all' ? 'btn-toast' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
                onClick={() => setFilter('all')}
              >
                All Items ({stats.total})
              </button>
              <button
                type="button"
                className={`btn-sm ${filter === 'new' ? 'btn-toast' : 'btn-secondary'}`}
                style={{
                  fontSize: 12,
                  background: filter === 'new' ? '#059669' : undefined,
                  borderColor: '#10b981',
                  color: filter === 'new' ? '#ffffff' : '#6ee7b7'
                }}
                onClick={() => setFilter('new')}
              >
                🆕 New to Add ({stats.newCount})
              </button>
              <button
                type="button"
                className={`btn-sm ${filter === 'update' ? 'btn-toast' : 'btn-secondary'}`}
                style={{
                  fontSize: 12,
                  background: filter === 'update' ? '#d97706' : undefined,
                  borderColor: '#f59e0b',
                  color: filter === 'update' ? '#ffffff' : '#fde68a'
                }}
                onClick={() => setFilter('update')}
              >
                🔄 Updates ({stats.updateCount})
              </button>
              <button
                type="button"
                className={`btn-sm ${filter === 'match' ? 'btn-toast' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
                onClick={() => setFilter('match')}
              >
                ⏸️ Unchanged ({stats.matchCount})
              </button>
            </div>

            <div style={{ width: 260 }}>
              <input
                type="text"
                placeholder="Search diffs by name or barcode…"
                className="input-field"
                style={{ padding: '5px 10px', fontSize: 12 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Diff Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', background: '#090d16' }}>
          <table className="review-table" style={{ width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#cbd5e1' }}>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={diffs.length > 0 && selectedCount === diffs.length}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      diffs.forEach((_, idx) => onUpdateDiffItem(idx, { selected: checked }));
                    }}
                  />
                </th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 130 }}>Barcode / UPC</th>
                <th>Item Name (Diff)</th>
                <th style={{ width: 150 }}>Category</th>
                <th style={{ width: 90 }}>Price</th>
                <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDiffs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                    No items match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredDiffs.map((diff) => {
                  const isNew = diff.status === 'new';
                  const isUpdate = diff.status === 'update';
                  return (
                    <tr
                      key={diff.id}
                      style={{
                        background: isNew ? 'rgba(5, 150, 105, 0.08)' : isUpdate ? 'rgba(217, 119, 6, 0.08)' : '#0f172a',
                        borderBottom: '1px solid #1e293b'
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!diff.selected}
                          onChange={(e) => {
                            onUpdateDiffItem(diff.index, { selected: e.target.checked });
                          }}
                        />
                      </td>
                      <td>
                        {isNew ? (
                          <span style={{ color: '#34d399', fontWeight: 600, fontSize: 11 }}>🆕 New Item</span>
                        ) : isUpdate ? (
                          <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: 11 }}>🔄 Changed</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>⏸️ Match</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>
                          {diff.incoming?.barcode || '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: '#f8fafc' }}>
                          {diff.incoming?.name}
                        </div>
                        {diff.fieldDiffs?.name && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            Was: <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{diff.fieldDiffs.name.old}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ color: '#cbd5e1' }}>{diff.incoming?.category || 'General'}</div>
                        {diff.fieldDiffs?.category && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            Was: <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{diff.fieldDiffs.category.old}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#38bdf8' }}>
                          {formatTagPrice(diff.incoming?.price)}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => setEditingItem({ diffIndex: diff.index, data: { ...diff.incoming } })}
                        >
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            background: '#0b1120',
            borderTop: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {selectedCount} of {diffs.length} items selected for database merge
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary btn-sm"
              style={{ borderColor: '#ef4444', color: '#fca5a5' }}
              onClick={onClose}
              disabled={isBusy}
            >
              ✕ Cancel Import
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              style={{ borderColor: '#3b82f6', color: '#93c5fd' }}
              onClick={onMergeNewOnly}
              disabled={isBusy || stats.newCount === 0}
              title="Import only brand new items into master database without touching existing entries"
            >
              🔵 Import New Items Only ({stats.newCount})
            </button>
            <button
              type="button"
              className="btn-toast btn-sm"
              style={{ background: '#059669', color: '#ffffff' }}
              onClick={onMergeAll}
              disabled={isBusy || selectedCount === 0}
              title="Import all selected items (add new items and update matching existing items)"
            >
              {isBusy ? 'Merging…' : `🟢 Import All Selected Items (${selectedCount})`}
            </button>
          </div>
        </div>

        {/* Inline Item Editor Modal */}
        {editingItem && (
          <div
            className="avery-modal-overlay"
            style={{ zIndex: 1300 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-diff-item-heading"
          >
            <div className="avery-modal-container" style={{ maxWidth: 520, height: 'auto', maxHeight: '85vh' }}>
              <div className="avery-header">
                <div className="avery-header-title">
                  <span style={{ fontSize: 20 }}>✏️</span>
                  <h3 id="edit-diff-item-heading" style={{ margin: 0, fontSize: 16 }}>
                    Edit Item Before Merging
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setEditingItem(null)}
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                    Item Name:
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editingItem.data.name || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, name: e.target.value }
                      })
                    }
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                      Category:
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={editingItem.data.category || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, category: e.target.value }
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                      Barcode / UPC:
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={editingItem.data.barcode || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, barcode: e.target.value }
                        })
                      }
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                      Price (USD):
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={editingItem.data.price || '0.00'}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, price: e.target.value }
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                      Size / Unit:
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 750ml, 6pk"
                      value={editingItem.data.size || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, size: e.target.value }
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '12px 20px',
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
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-toast btn-sm"
                  onClick={() => {
                    onUpdateDiffItem(editingItem.diffIndex, {
                      incoming: editingItem.data
                    });
                    setEditingItem(null);
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
