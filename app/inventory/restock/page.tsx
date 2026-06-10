'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import toast, { Toaster } from 'react-hot-toast';
import {
  Plus, Trash2, AlertTriangle, Package, History, ShoppingCart,
  ArrowUpCircle, Search, RefreshCw, Check, ChevronDown, ChevronUp,
  TrendingDown, Loader2, PackagePlus, ClipboardList,
} from 'lucide-react';
import { useHideMoney } from '@/hooks/useHideMoney';

interface Ingredient {
  id: number; name: string; unit: string; current_quantity: number;
  minimum_quantity: number; unit_cost: number;
}

interface RestockItem {
  ingredient_id: number;
  quantity: number;
  unit_cost: number;
}

interface BatchRecord {
  batch_id: string;
  date: string;
  notes: string;
  items: Array<{
    ingredient_name: string;
    ingredient_unit: string;
    quantity: number;
    unit_cost: number;
    cost: number;
  }>;
  total_cost: number;
}

interface SingleRestock {
  id: number;
  date: string;
  ingredient_name: string;
  ingredient_unit: string;
  quantity: number;
  unit_cost: number;
  cost: number;
  notes: string;
}

type Tab = 'restock' | 'history';

export default function InventoryRestockPage() {
  const [tab, setTab] = useState<Tab>('restock');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Restock form
  const [restockItems, setRestockItems] = useState<RestockItem[]>([
    { ingredient_id: 0, quantity: 0, unit_cost: 0 },
  ]);
  const [restockNotes, setRestockNotes] = useState('');

  // Quick add mode
  const [quickMode, setQuickMode] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  // History
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [singleRestocks, setSingleRestocks] = useState<SingleRestock[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const { mask } = useHideMoney();

  const fetchIngredients = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        setIngredients(data.ingredients || []);
      }
    } catch {
      toast.error('Failed to load ingredients');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/inventory/restock?limit=100');
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
        setSingleRestocks(data.single_restocks || []);
      }
    } catch {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIngredients();
    fetchHistory();
  }, [fetchIngredients, fetchHistory]);

  // Helpers
  const getIngredient = (id: number) => ingredients.find(i => i.id === id);
  const lowStock = ingredients.filter(i => i.minimum_quantity > 0 && i.current_quantity <= i.minimum_quantity);
  const outOfStock = ingredients.filter(i => i.current_quantity <= 0);

  // Restock form handlers
  const addRow = () => {
    setRestockItems([...restockItems, { ingredient_id: 0, quantity: 0, unit_cost: 0 }]);
  };

  const removeRow = (idx: number) => {
    if (restockItems.length <= 1) return;
    setRestockItems(restockItems.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof RestockItem, value: number) => {
    const updated = [...restockItems];
    updated[idx] = { ...updated[idx], [field]: value };
    // Auto-fill unit_cost from ingredient data if not manually set
    if (field === 'ingredient_id' && value > 0) {
      const ing = getIngredient(value);
      if (ing && updated[idx].unit_cost === 0) {
        updated[idx].unit_cost = ing.unit_cost;
      }
    }
    setRestockItems(updated);
  };

  const quickAddIngredient = (ingId: number) => {
    // Check if already in list
    const existingIdx = restockItems.findIndex(r => r.ingredient_id === ingId);
    if (existingIdx >= 0) {
      toast('Already in list — update quantity below', { icon: '👇' });
      return;
    }
    const ing = getIngredient(ingId);
    // Replace empty first row or add new
    const emptyIdx = restockItems.findIndex(r => r.ingredient_id === 0);
    if (emptyIdx >= 0) {
      const updated = [...restockItems];
      updated[emptyIdx] = { ingredient_id: ingId, quantity: 0, unit_cost: ing?.unit_cost || 0 };
      setRestockItems(updated);
    } else {
      setRestockItems([...restockItems, { ingredient_id: ingId, quantity: 0, unit_cost: ing?.unit_cost || 0 }]);
    }
    toast.success(`${ing?.name} added to restock list`);
  };

  const addAllLowStock = () => {
    if (lowStock.length === 0) { toast('No low stock items!', { icon: '✅' }); return; }
    const existingIds = new Set(restockItems.filter(r => r.ingredient_id > 0).map(r => r.ingredient_id));
    const newItems: RestockItem[] = restockItems.filter(r => r.ingredient_id > 0);
    for (const ing of lowStock) {
      if (!existingIds.has(ing.id)) {
        newItems.push({ ingredient_id: ing.id, quantity: 0, unit_cost: ing.unit_cost });
      }
    }
    if (newItems.length === 0) {
      newItems.push({ ingredient_id: 0, quantity: 0, unit_cost: 0 });
    }
    setRestockItems(newItems);
    toast.success(`${lowStock.length} low-stock items added`);
  };

  const handleSubmitRestock = async () => {
    const validItems = restockItems.filter(r => r.ingredient_id > 0 && r.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Add at least one ingredient with quantity');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validItems, notes: restockNotes || undefined }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Stock updated!');
        // Reset form
        setRestockItems([{ ingredient_id: 0, quantity: 0, unit_cost: 0 }]);
        setRestockNotes('');
        // Refresh data
        fetchIngredients();
        fetchHistory();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to restock');
      }
    } catch {
      toast.error('Failed to save restock');
    } finally {
      setSaving(false);
    }
  };

  const validItemCount = restockItems.filter(r => r.ingredient_id > 0 && r.quantity > 0).length;
  const totalCost = restockItems.reduce((sum, r) => {
    if (r.ingredient_id > 0 && r.quantity > 0) {
      return sum + r.quantity * r.unit_cost;
    }
    return sum;
  }, 0);

  const filteredIngredients = ingredients.filter(i =>
    i.name.toLowerCase().includes((quickMode ? quickSearch : search).toLowerCase())
  );

  const fmtDate = (d: string) => new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <>
      <Navbar />
      <Toaster position="top-right" />
      <main className="md:ml-64 min-h-screen bg-gray-50 p-4 md:p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📦 Inventory Add Up</h1>
            <p className="text-sm text-gray-500 mt-1">
              Record daily/monthly stock purchases — stays in sync with your inventory
            </p>
          </div>
          <a href="/inventory" className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm">
            <Package className="w-4 h-4" /> View Full Inventory
          </a>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
              <div><p className="text-xs text-gray-500">Total Ingredients</p><p className="text-xl font-bold text-gray-800">{ingredients.length}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
              <div><p className="text-xs text-gray-500">Low Stock</p><p className="text-xl font-bold text-amber-600">{lowStock.length}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <div><p className="text-xs text-gray-500">Out of Stock</p><p className="text-xl font-bold text-red-600">{outOfStock.length}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><ClipboardList className="w-5 h-5 text-green-600" /></div>
              <div><p className="text-xs text-gray-500">Purchase Batches</p><p className="text-xl font-bold text-green-600">{batches.length}</p></div>
            </div>
          </div>
        </div>

        {/* Low Stock Alert - Quick Action */}
        {lowStock.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-amber-700 font-semibold">
                <AlertTriangle className="w-5 h-5" /> {lowStock.length} ingredient(s) need restocking!
              </div>
              <button onClick={addAllLowStock}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add All to Restock
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(i => (
                <button key={i.id} onClick={() => quickAddIngredient(i.id)}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  {i.name}: {i.current_quantity}/{i.minimum_quantity} {i.unit}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm mb-6 border">
          <button onClick={() => setTab('restock')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'restock' ? 'bg-[#1B2E3C] text-white shadow' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            <PackagePlus className="w-4 h-4" />
            <span>Add Stock</span>
          </button>
          <button onClick={() => setTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'history' ? 'bg-[#1B2E3C] text-white shadow' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            <History className="w-4 h-4" />
            <span>Purchase History</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'history' ? 'bg-white/20' : 'bg-gray-200'}`}>
              {batches.length + singleRestocks.length}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...
          </div>
        ) : (
          <>
            {/* ==================== ADD STOCK TAB ==================== */}
            {tab === 'restock' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT: Restock Form */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl border shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-green-600" />
                        Stock Purchase Entry
                      </h2>
                      <div className="flex gap-2">
                        <button onClick={addAllLowStock}
                          className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200">
                          ⚠️ Add Low Stock
                        </button>
                        <button onClick={() => setQuickMode(!quickMode)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                            quickMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                          ⚡ Quick Pick
                        </button>
                      </div>
                    </div>

                    {/* Quick Pick Mode */}
                    {quickMode && (
                      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-xs text-blue-700 font-medium mb-2">Click ingredients to add to restock list:</p>
                        <div className="relative mb-3">
                          <Search className="w-4 h-4 absolute left-3 top-2.5 text-blue-400" />
                          <input type="text" placeholder="Search ingredients..." value={quickSearch}
                            onChange={e => setQuickSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {filteredIngredients.map(ing => {
                            const isSelected = restockItems.some(r => r.ingredient_id === ing.id);
                            const isLow = ing.minimum_quantity > 0 && ing.current_quantity <= ing.minimum_quantity;
                            return (
                              <button key={ing.id} onClick={() => quickAddIngredient(ing.id)}
                                disabled={isSelected}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-green-100 text-green-700 cursor-default'
                                    : isLow
                                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 cursor-pointer'
                                      : 'bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 cursor-pointer'
                                }`}>
                                {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                {ing.name}
                                <span className="text-[10px] opacity-60">({ing.current_quantity} {ing.unit})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Table Header */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 pb-2 border-b mb-2 px-1">
                      <span className="col-span-4">Ingredient</span>
                      <span className="col-span-2">Current Stock</span>
                      <span className="col-span-2">Add Qty</span>
                      <span className="col-span-2">Unit Cost (₹)</span>
                      <span className="col-span-1 text-right">Cost</span>
                      <span className="col-span-1"></span>
                    </div>

                    {/* Restock Rows */}
                    <div className="space-y-2 mb-4">
                      {restockItems.map((item, idx) => {
                        const ing = getIngredient(item.ingredient_id);
                        const isLow = ing && ing.minimum_quantity > 0 && ing.current_quantity <= ing.minimum_quantity;
                        const rowCost = item.quantity > 0 && item.unit_cost > 0 ? item.quantity * item.unit_cost : 0;
                        return (
                          <div key={idx} className={`grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg ${
                            isLow ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'
                          }`}>
                            {/* Ingredient Select */}
                            <div className="sm:col-span-4">
                              <select value={item.ingredient_id}
                                onChange={e => updateRow(idx, 'ingredient_id', Number(e.target.value))}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:outline-none bg-white">
                                <option value={0}>Select ingredient...</option>
                                {ingredients.map(i => (
                                  <option key={i.id} value={i.id}>
                                    {i.name} ({i.unit}) {i.minimum_quantity > 0 && i.current_quantity <= i.minimum_quantity ? '⚠️' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Current Stock */}
                            <div className="sm:col-span-2">
                              {ing ? (
                                <div className={`text-sm font-mono px-2 py-1.5 rounded ${
                                  isLow ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-100'
                                }`}>
                                  {ing.current_quantity} {ing.unit}
                                  {isLow && <span className="text-amber-500 text-[10px] ml-1">LOW</span>}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 px-2">—</span>
                              )}
                            </div>

                            {/* Quantity */}
                            <div className="sm:col-span-2">
                              <input type="number" min="0" step="0.1" value={item.quantity || ''}
                                onChange={e => updateRow(idx, 'quantity', Number(e.target.value))}
                                placeholder="Qty"
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:outline-none font-mono" />
                            </div>

                            {/* Unit Cost */}
                            <div className="sm:col-span-2">
                              <input type="number" min="0" step="0.01" value={item.unit_cost || ''}
                                onChange={e => updateRow(idx, 'unit_cost', Number(e.target.value))}
                                placeholder="₹ cost"
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:outline-none font-mono" />
                            </div>

                            {/* Row Total */}
                            <div className="sm:col-span-1 text-right">
                              <span className="text-sm font-semibold text-gray-700">
                                {rowCost > 0 ? mask(Math.round(rowCost)) : '—'}
                              </span>
                            </div>

                            {/* Delete */}
                            <div className="sm:col-span-1 flex justify-end">
                              <button onClick={() => removeRow(idx)}
                                disabled={restockItems.length <= 1}
                                className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-20 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Row Button */}
                    <button onClick={addRow}
                      className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Add Another Ingredient
                    </button>

                    {/* Notes */}
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">📝 Purchase Notes (optional)</label>
                      <input type="text" value={restockNotes} onChange={e => setRestockNotes(e.target.value)}
                        placeholder="e.g. Daily market purchase, Monthly wholesale order..."
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:outline-none" />
                    </div>

                    {/* Summary + Submit */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-sm text-gray-600">
                            <strong className="text-green-700">{validItemCount}</strong> item(s) to restock
                          </span>
                          {totalCost > 0 && (
                            <span className="text-sm text-gray-500 ml-3">
                              Total: <strong className="text-gray-800">{mask(Math.round(totalCost))}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={handleSubmitRestock}
                        disabled={saving || validItemCount === 0}
                        className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
                        {saving ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                        ) : (
                          <><ArrowUpCircle className="w-5 h-5" /> Add {validItemCount} Item(s) to Stock</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Current Stock Overview */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-xl border shadow-sm p-5 sticky top-6">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" /> Current Stock
                    </h3>

                    <div className="relative mb-3">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input type="text" placeholder="Search..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>

                    <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                      {filteredIngredients.map(ing => {
                        const isLow = ing.minimum_quantity > 0 && ing.current_quantity <= ing.minimum_quantity;
                        const isOut = ing.current_quantity <= 0;
                        return (
                          <div key={ing.id}
                            onClick={() => quickAddIngredient(ing.id)}
                            className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                              isOut ? 'bg-red-50 border border-red-200 hover:bg-red-100' :
                              isLow ? 'bg-amber-50 border border-amber-200 hover:bg-amber-100' :
                              'bg-gray-50 hover:bg-gray-100'
                            }`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{ing.name}</p>
                              <p className="text-[10px] text-gray-500">Min: {ing.minimum_quantity} {ing.unit}</p>
                            </div>
                            <div className="text-right ml-2">
                              <p className={`text-sm font-bold font-mono ${
                                isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-800'
                              }`}>
                                {ing.current_quantity}
                              </p>
                              <p className="text-[10px] text-gray-400">{ing.unit}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {filteredIngredients.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-sm">No ingredients found</div>
                    )}

                    <div className="mt-3 pt-3 border-t">
                      <p className="text-[10px] text-gray-400 text-center">
                        💡 Click any ingredient to add it to the restock list
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== HISTORY TAB ==================== */}
            {tab === 'history' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-500">Your stock purchase history — batches and individual restocks</p>
                  <button onClick={fetchHistory} disabled={historyLoading}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                    <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>

                {historyLoading ? (
                  <div className="text-center py-20 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...
                  </div>
                ) : (
                  <>
                    {/* Batch Purchases */}
                    {batches.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-green-600" /> Bulk Purchases ({batches.length})
                        </h3>
                        <div className="space-y-3">
                          {batches.map(batch => (
                            <div key={batch.batch_id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                              <button
                                onClick={() => setExpandedBatch(expandedBatch === batch.batch_id ? null : batch.batch_id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                    <PackagePlus className="w-5 h-5 text-green-600" />
                                  </div>
                                  <div className="text-left">
                                    <p className="font-semibold text-gray-800 text-sm">
                                      {batch.items.length} ingredient(s) restocked
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {fmtDate(batch.date)}
                                      {batch.notes && <span className="ml-2 text-gray-400">· {batch.notes}</span>}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {batch.total_cost > 0 && (
                                    <span className="text-sm font-bold text-green-700">{mask(Math.round(batch.total_cost))}</span>
                                  )}
                                  {expandedBatch === batch.batch_id
                                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                                  }
                                </div>
                              </button>

                              {expandedBatch === batch.batch_id && (
                                <div className="border-t px-4 pb-4">
                                  <table className="w-full text-sm mt-2">
                                    <thead>
                                      <tr className="text-left text-xs font-semibold text-gray-500">
                                        <th className="py-2">Ingredient</th>
                                        <th className="py-2 text-right">Quantity</th>
                                        <th className="py-2 text-right">Unit Cost</th>
                                        <th className="py-2 text-right">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {batch.items.map((item, idx) => (
                                        <tr key={idx} className="border-t border-gray-100">
                                          <td className="py-2 font-medium text-gray-800">{item.ingredient_name}</td>
                                          <td className="py-2 text-right font-mono text-gray-600">
                                            +{item.quantity} {item.ingredient_unit}
                                          </td>
                                          <td className="py-2 text-right font-mono text-gray-500">
                                            {item.unit_cost > 0 ? mask(item.unit_cost) : '—'}
                                          </td>
                                          <td className="py-2 text-right font-mono font-semibold text-gray-800">
                                            {item.cost > 0 ? mask(Math.round(item.cost)) : '—'}
                                          </td>
                                        </tr>
                                      ))}
                                      {batch.total_cost > 0 && (
                                        <tr className="border-t-2 border-gray-200">
                                          <td colSpan={3} className="py-2 font-semibold text-gray-700 text-right">Total</td>
                                          <td className="py-2 text-right font-bold text-green-700">{mask(Math.round(batch.total_cost))}</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Single Restocks */}
                    {singleRestocks.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <ArrowUpCircle className="w-4 h-4 text-blue-600" /> Individual Stock Additions ({singleRestocks.length})
                        </h3>
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Ingredient</th>
                                <th className="px-4 py-3 text-right">Quantity</th>
                                <th className="px-4 py-3 text-right">Cost</th>
                                <th className="px-4 py-3">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {singleRestocks.map(r => (
                                <tr key={r.id} className="border-t hover:bg-gray-50">
                                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                                  <td className="px-4 py-3 font-medium text-gray-800">{r.ingredient_name}</td>
                                  <td className="px-4 py-3 text-right font-mono text-green-600">+{r.quantity} {r.ingredient_unit}</td>
                                  <td className="px-4 py-3 text-right font-mono text-gray-600">{r.cost > 0 ? mask(Math.round(r.cost)) : '—'}</td>
                                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{r.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {batches.length === 0 && singleRestocks.length === 0 && (
                      <div className="text-center py-20 text-gray-400">
                        <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-lg font-medium">No purchase history yet</p>
                        <p className="text-sm mt-1">Add stock using the &quot;Add Stock&quot; tab to see purchase records here</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Sync Indicator */}
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6">
          <div className="bg-green-100 border border-green-300 text-green-700 px-3 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Synced with Inventory
          </div>
        </div>
      </main>
    </>
  );
}
