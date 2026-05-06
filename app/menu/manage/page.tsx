'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Search,
  UtensilsCrossed,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  available: boolean;
  has_variants: boolean;
  half_price: number | null;
  full_price: number | null;
}

interface ItemForm {
  name: string;
  price: string;
  category: string;
  available: boolean;
  has_variants: boolean;
  half_price: string;
  full_price: string;
}

const emptyForm: ItemForm = {
  name: '',
  price: '',
  category: '',
  available: true,
  has_variants: false,
  half_price: '',
  full_price: '',
};

export default function MenuManagePage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvData, setCsvData] = useState<{ name: string; category: string; price: string }[]>([]);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [clearingMenu, setClearingMenu] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      setItems(data.items);
    } catch {
      toast.error('Failed to fetch menu items');
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(items.map((i) => i.category))).sort();

  const filteredItems = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const openAddModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setForm({
      name: item.name,
      price: String(item.price),
      category: item.category,
      available: item.available,
      has_variants: item.has_variants || false,
      half_price: item.half_price ? String(item.half_price) : '',
      full_price: item.full_price ? String(item.full_price) : '',
    });
    setEditingId(item.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.category) {
      toast.error('Name and category are required');
      return;
    }

    if (form.has_variants) {
      const halfPrice = parseFloat(form.half_price);
      const fullPrice = parseFloat(form.full_price);
      if (isNaN(halfPrice) || halfPrice <= 0) {
        toast.error('Enter a valid half price');
        return;
      }
      if (isNaN(fullPrice) || fullPrice <= 0) {
        toast.error('Enter a valid full price');
        return;
      }
    } else {
      const price = parseFloat(form.price);
      if (isNaN(price) || price < 0) {
        toast.error('Enter a valid price');
        return;
      }
    }

    setSaving(true);
    try {
      const halfPrice = parseFloat(form.half_price);
      const fullPrice = parseFloat(form.full_price);
      const price = form.has_variants ? halfPrice : parseFloat(form.price);

      const body = {
        name: form.name,
        price,
        category: form.category,
        available: form.available,
        has_variants: form.has_variants,
        half_price: form.has_variants ? halfPrice : null,
        full_price: form.has_variants ? fullPrice : null,
      };

      let res;
      if (editingId) {
        res = await fetch(`/api/menu/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        toast.success(editingId ? 'Item updated!' : 'Item added!');
        setShowModal(false);
        fetchItems();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Operation failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Item deleted');
        fetchItems();
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Network error');
    }
  };

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
            <p className="text-gray-500 mt-1">{items.length} items in menu</p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            {items.length > 0 && (
              <button
                onClick={async () => {
                  if (!confirm(`⚠️ Delete ALL ${items.length} menu items? This cannot be undone!`)) return;
                  if (!confirm('Are you absolutely sure? Type OK to proceed.')) return;
                  setClearingMenu(true);
                  try {
                    const res = await fetch('/api/menu', { method: 'DELETE' });
                    if (res.ok) {
                      const data = await res.json();
                      toast.success(`🗑️ Cleared ${data.deleted} items`);
                      fetchItems();
                    } else {
                      toast.error('Failed to clear menu');
                    }
                  } catch {
                    toast.error('Network error');
                  } finally {
                    setClearingMenu(false);
                  }
                }}
                disabled={clearingMenu}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {clearingMenu ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Clear All
              </button>
            )}
            <button
              onClick={() => { setCsvData([]); setCsvResult(null); setShowCsvModal(true); }}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4" />
              Bulk CSV
            </button>
            <button
              onClick={openAddModal}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="input pl-9 py-2 text-sm"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input w-full sm:w-40 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="card text-center py-12">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No items found</p>
            <button onClick={openAddModal} className="btn-primary mt-4">
              Add your first item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border-2 bg-white hover:shadow-md transition-all ${
                  !item.available ? 'opacity-50 border-gray-200' : 'border-gray-100 hover:border-amber-200'
                }`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <h3 className="font-medium text-gray-900 text-sm leading-tight">{item.name}</h3>
                  <span className={`shrink-0 ml-1 w-2 h-2 rounded-full mt-1.5 ${item.available ? 'bg-green-500' : 'bg-red-400'}`} />
                </div>
                <p className="text-xs text-gray-500 mb-2">{item.category}</p>
                <div className="flex items-center justify-between">
                  {item.has_variants ? (
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500">H: ₹{item.half_price} | F: ₹{item.full_price}</span>
                    </div>
                  ) : (
                    <span className="font-bold text-gray-900">₹{item.price}</span>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => openEditModal(item)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-amber-100 text-gray-500 hover:text-amber-700 flex items-center justify-center transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingId ? 'Edit Item' : 'Add New Item'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input"
                    placeholder="e.g., Butter Chicken"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input"
                    placeholder="e.g., Main Course"
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                {/* Variant Toggle */}
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="has_variants"
                    checked={form.has_variants}
                    onChange={(e) => setForm({ ...form, has_variants: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="has_variants" className="text-sm font-medium text-amber-800">
                    Has Half / Full pricing
                  </label>
                </div>

                {form.has_variants ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Half Price (₹)
                      </label>
                      <input
                        type="number"
                        value={form.half_price}
                        onChange={(e) => setForm({ ...form, half_price: e.target.value })}
                        className="input"
                        placeholder="e.g., 149"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Price (₹)
                      </label>
                      <input
                        type="number"
                        value={form.full_price}
                        onChange={(e) => setForm({ ...form, full_price: e.target.value })}
                        className="input"
                        placeholder="e.g., 279"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (₹)
                    </label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="input"
                      placeholder="e.g., 250"
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="available"
                    checked={form.available}
                    onChange={(e) => setForm({ ...form, available: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="available" className="text-sm font-medium text-gray-700">
                    Available for ordering
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Update' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CSV Bulk Upload Modal */}
        {showCsvModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => !csvUploading && setShowCsvModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  Bulk CSV Upload
                </h2>
                <button onClick={() => !csvUploading && setShowCsvModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
                <p className="font-medium text-blue-800 mb-1">CSV Format:</p>
                <code className="text-blue-700 text-xs bg-blue-100 px-2 py-1 rounded block">Item, Category, Price1, Price2</code>
                <p className="text-blue-600 text-xs mt-1">Supports comma or tab separated. First row header auto-skipped.</p>
                <pre className="text-blue-600 text-xs mt-1 bg-blue-100 p-2 rounded">
{`Masala Chai,Beverages,30
Chilli Paneer,CHINESE (GRAVY/DRY),149,179
Masala Chaap,CHAAP (HALF/FULL),139,269
Veg Momos,MOMOS (ST./ FRY),59,69`}
                </pre>
                <p className="text-blue-600 text-xs mt-1 font-medium">💡 4 columns = variant pricing! Labels come from brackets: (GRAVY/DRY), (HALF/FULL), etc.</p>
              </div>

              {/* File Input */}
              {!csvResult && (
                <>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    id="csv-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string;
                        const lines = text.split('\n').map((l) => l.trim()).filter((l) => l);
                        const parsed: { name: string; category: string; price: string }[] = [];
                        for (let i = 0; i < lines.length; i++) {
                          // Handle tab or comma separated
                          const cols = lines[i].includes('\t')
                            ? lines[i].split('\t').map((c) => c.trim())
                            : lines[i].split(',').map((c) => c.trim());
                          if (cols.length < 3) continue;
                          // Skip header row
                          if (i === 0 && (cols[0].toLowerCase() === 'item' || cols[0].toLowerCase() === 'name')) continue;
                          // 4 columns: Name, Category, Price1, Price2 → convert to "price1 / price2"
                          if (cols.length >= 4 && cols[2] && cols[3] && !isNaN(Number(cols[2])) && !isNaN(Number(cols[3]))) {
                            parsed.push({ name: cols[0], category: cols[1], price: `${cols[2]} / ${cols[3]}` });
                          } else {
                            // 3 columns or "price1 / price2" format
                            parsed.push({ name: cols[0], category: cols[1], price: cols.slice(2).join(',').trim() });
                          }
                        }
                        setCsvData(parsed);
                      };
                      reader.readAsText(file);
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="csv-upload"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-all mb-4"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm font-medium text-gray-700">Click to select CSV file</p>
                    <p className="text-xs text-gray-400">or drag & drop</p>
                  </label>
                </>
              )}

              {/* Preview */}
              {csvData.length > 0 && !csvResult && (
                <>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Preview ({csvData.length} items):
                    </p>
                    <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-600">#</th>
                            <th className="text-left px-3 py-2 text-gray-600">Item</th>
                            <th className="text-left px-3 py-2 text-gray-600">Category</th>
                            <th className="text-right px-3 py-2 text-gray-600">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.map((row, idx) => {
                            const isVariant = /^\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*$/.test(row.price);
                            return (
                              <tr key={idx} className="border-t">
                                <td className="px-3 py-1.5 text-gray-400">{idx + 1}</td>
                                <td className="px-3 py-1.5 font-medium">{row.name}</td>
                                <td className="px-3 py-1.5 text-gray-600">{row.category}</td>
                                <td className="px-3 py-1.5 text-right">
                                  {isVariant ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">H/F</span>
                                      ₹{row.price}
                                    </span>
                                  ) : (
                                    <>₹{row.price}</>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setCsvData([])} className="btn-secondary flex-1">Clear</button>
                    <button
                      onClick={async () => {
                        setCsvUploading(true);
                        try {
                          const res = await fetch('/api/menu/bulk', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ items: csvData }),
                          });
                          const data = await res.json();
                          setCsvResult({ success: data.success, failed: data.failed, errors: data.errors || [] });
                          if (data.success > 0) {
                            toast.success(`${data.success} items added!`);
                            fetchItems();
                          }
                          if (data.failed > 0) {
                            toast.error(`${data.failed} items failed`);
                          }
                        } catch {
                          toast.error('Upload failed');
                        } finally {
                          setCsvUploading(false);
                        }
                      }}
                      disabled={csvUploading}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      {csvUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {csvUploading ? 'Uploading...' : `Upload ${csvData.length} Items`}
                    </button>
                  </div>
                </>
              )}

              {/* Result */}
              {csvResult && (
                <div className="space-y-3">
                  <div className="flex gap-4">
                    {csvResult.success > 0 && (
                      <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                        <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-green-700">{csvResult.success}</p>
                        <p className="text-xs text-green-600">Added</p>
                      </div>
                    )}
                    {csvResult.failed > 0 && (
                      <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                        <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-red-700">{csvResult.failed}</p>
                        <p className="text-xs text-red-600">Failed</p>
                      </div>
                    )}
                  </div>
                  {csvResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold text-red-700 mb-1">Errors:</p>
                      {csvResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-600">{err}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowCsvModal(false); setCsvData([]); setCsvResult(null); }} className="btn-primary w-full">
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
