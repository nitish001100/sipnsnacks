'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import toast, { Toaster } from 'react-hot-toast';
import {
  Plus, Minus, Trash2, AlertTriangle, Package, BookOpen, History,
  ArrowUpCircle, ArrowDownCircle, Search, RefreshCw, Download, Edit2,
  DollarSign, TrendingDown, BarChart3,
} from 'lucide-react';

interface Ingredient {
  id: number; name: string; unit: string; current_quantity: number;
  minimum_quantity: number; unit_cost: number; created_at: string; updated_at: string;
}

interface MenuItem { id: number; name: string; price: number; category: string; }

interface Recipe {
  id: number; menu_item_id: number; ingredient_id: number; quantity_required: number;
  ingredient_name?: string; ingredient_unit?: string; menu_item_name?: string;
}

interface Transaction {
  id: number; ingredient_id: number; transaction_type: string;
  quantity_change: number; order_id: number | null; notes: string;
  created_at: string; ingredient_name?: string;
}

type Tab = 'ingredients' | 'recipes' | 'history' | 'daily-log';

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('ingredients');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  // Add ingredient modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIngredient, setNewIngredient] = useState({ name: '', unit: 'pieces', current_quantity: 0, minimum_quantity: 0, unit_cost: 0 });

  // Edit ingredient modal
  const [editModal, setEditModal] = useState<Ingredient | null>(null);
  const [editData, setEditData] = useState({ name: '', unit: '', current_quantity: 0, minimum_quantity: 0, unit_cost: 0 });

  // Stock adjustment modal
  const [stockModal, setStockModal] = useState<{ ingredient: Ingredient; type: 'add' | 'subtract' } | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [stockNotes, setStockNotes] = useState('');

  // Recipe modal
  const [recipeModal, setRecipeModal] = useState<MenuItem | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ ingredient_id: number; quantity_required: number }>>([]);

  // Daily log date
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchIngredients = useCallback(async () => {
    try { const res = await fetch('/api/inventory'); const data = await res.json(); setIngredients(data.ingredients || []); } catch { toast.error('Failed to load ingredients'); }
  }, []);

  const fetchMenu = useCallback(async () => {
    try { const res = await fetch('/api/menu'); const data = await res.json(); setMenuItems(data.items || []); } catch { /* ignore */ }
  }, []);

  const fetchRecipes = useCallback(async () => {
    try { const res = await fetch('/api/inventory/recipes'); const data = await res.json(); setRecipes(data.recipes || []); } catch { toast.error('Failed to load recipes'); }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try { const res = await fetch('/api/inventory/transactions?limit=200'); const data = await res.json(); setTransactions(data.transactions || []); } catch { toast.error('Failed to load history'); }
  }, []);

  useEffect(() => {
    Promise.all([fetchIngredients(), fetchMenu(), fetchRecipes(), fetchTransactions()])
      .finally(() => setLoading(false));
  }, [fetchIngredients, fetchMenu, fetchRecipes, fetchTransactions]);

  const handleAddIngredient = async () => {
    if (!newIngredient.name || !newIngredient.unit) { toast.error('Name and unit are required'); return; }
    try {
      const res = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newIngredient) });
      if (!res.ok) throw new Error();
      toast.success('Ingredient added!');
      setShowAddModal(false);
      setNewIngredient({ name: '', unit: 'pieces', current_quantity: 0, minimum_quantity: 0, unit_cost: 0 });
      fetchIngredients();
    } catch { toast.error('Failed to add ingredient'); }
  };

  const handleEditIngredient = async () => {
    if (!editModal) return;
    try {
      const res = await fetch('/api/inventory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editModal.id, ...editData }) });
      if (!res.ok) throw new Error();
      toast.success('Ingredient updated!');
      setEditModal(null);
      fetchIngredients();
    } catch { toast.error('Failed to update'); }
  };

  const handleDeleteIngredient = async (id: number) => {
    if (!confirm('Delete this ingredient? Related recipes will also be removed.')) return;
    try {
      const res = await fetch('/api/inventory', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error();
      toast.success('Ingredient deleted');
      fetchIngredients();
      fetchRecipes();
    } catch { toast.error('Failed to delete'); }
  };

  const handleStockAdjust = async () => {
    if (!stockModal || stockQty <= 0) return;
    const qty = stockModal.type === 'subtract' ? -stockQty : stockQty;
    try {
      const res = await fetch('/api/inventory/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ingredient_id: stockModal.ingredient.id, quantity: qty, notes: stockNotes }) });
      if (!res.ok) throw new Error();
      toast.success(`Stock ${stockModal.type === 'add' ? 'added' : 'subtracted'}!`);
      setStockModal(null); setStockQty(0); setStockNotes('');
      fetchIngredients(); fetchTransactions();
    } catch { toast.error('Failed to adjust stock'); }
  };

  const handleSaveRecipe = async () => {
    if (!recipeModal) return;
    const validIngredients = recipeIngredients.filter(i => i.ingredient_id && i.quantity_required > 0);
    try {
      const res = await fetch('/api/inventory/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ menu_item_id: recipeModal.id, ingredients: validIngredients }) });
      if (!res.ok) throw new Error();
      toast.success('Recipe saved!');
      setRecipeModal(null);
      fetchRecipes();
    } catch { toast.error('Failed to save recipe'); }
  };

  const openRecipeModal = async (menuItem: MenuItem) => {
    setRecipeModal(menuItem);
    try {
      const res = await fetch(`/api/inventory/recipes?menu_item_id=${menuItem.id}`);
      const data = await res.json();
      const existing = (data.recipe || []).map((r: Recipe) => ({ ingredient_id: r.ingredient_id, quantity_required: r.quantity_required }));
      setRecipeIngredients(existing.length > 0 ? existing : [{ ingredient_id: 0, quantity_required: 0 }]);
    } catch { setRecipeIngredients([{ ingredient_id: 0, quantity_required: 0 }]); }
  };

  const handleExportInventory = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/inventory/export');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sipnsnacks_inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast.success('Inventory report downloaded!');
    } catch { toast.error('Failed to export'); }
    finally { setExporting(false); }
  };

  const lowStock = ingredients.filter(i => i.minimum_quantity > 0 && i.current_quantity <= i.minimum_quantity);
  const outOfStock = ingredients.filter(i => i.current_quantity <= 0);
  const totalValue = ingredients.reduce((s, i) => s + i.current_quantity * i.unit_cost, 0);
  const filteredIngredients = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  // Daily log: group transactions by date
  const logTxns = transactions.filter((t) => {
    const txDate = new Date(t.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return txDate === logDate;
  });
  const logByIngredient = new Map<number, { name: string; added: number; deducted: number; orderDeducted: number }>();
  logTxns.forEach(tx => {
    const key = tx.ingredient_id;
    const existing = logByIngredient.get(key) || { name: tx.ingredient_name || `#${key}`, added: 0, deducted: 0, orderDeducted: 0 };
    if (tx.transaction_type === 'manual_add') existing.added += tx.quantity_change;
    else if (tx.transaction_type === 'manual_subtract') existing.deducted += Math.abs(tx.quantity_change);
    else if (tx.transaction_type === 'order_deduction') existing.orderDeducted += Math.abs(tx.quantity_change);
    logByIngredient.set(key, existing);
  });

  const tabs = [
    { id: 'ingredients' as Tab, label: 'Ingredients', icon: Package, count: ingredients.length },
    { id: 'recipes' as Tab, label: 'Recipes', icon: BookOpen, count: recipes.length },
    { id: 'history' as Tab, label: 'History', icon: History, count: transactions.length },
    { id: 'daily-log' as Tab, label: 'Daily Log', icon: BarChart3, count: logByIngredient.size },
  ];

  return (
    <>
      <Navbar />
      <Toaster position="top-right" />
      <main className="md:ml-64 min-h-screen bg-gray-50 p-4 md:p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📦 Inventory Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage ingredients, recipes, track stock & export reports</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportInventory} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50">
              <Download className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#1B2E3C] text-white rounded-lg hover:bg-[#2a4a5c] transition-colors font-medium text-sm">
              <Plus className="w-4 h-4" /> Add Ingredient
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
              <div><p className="text-xs text-gray-500">Total Items</p><p className="text-xl font-bold text-gray-800">{ingredients.length}</p></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="w-5 h-5 text-green-600" /></div>
              <div><p className="text-xs text-gray-500">Stock Value</p><p className="text-xl font-bold text-green-600">₹{Math.round(totalValue).toLocaleString('en-IN')}</p></div>
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
        </div>

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
              <AlertTriangle className="w-5 h-5" /> Low Stock Alert — {lowStock.length} ingredient(s) below minimum!
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(i => (
                <span key={i.id} className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-medium">
                  {i.name}: {i.current_quantity} {i.unit} (min: {i.minimum_quantity})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm mb-6 border">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-[#1B2E3C] text-white shadow' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-gray-200'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : (
          <>
            {/* ==================== INGREDIENTS TAB ==================== */}
            {tab === 'ingredients' && (
              <div>
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input type="text" placeholder="Search ingredients..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredIngredients.map(ing => {
                    const isLow = ing.minimum_quantity > 0 && ing.current_quantity <= ing.minimum_quantity;
                    return (
                      <div key={ing.id} className={`bg-white rounded-xl border p-4 shadow-sm ${isLow ? 'border-red-300 bg-red-50/50' : ''}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-800">{ing.name}</h3>
                            <p className="text-xs text-gray-500">Unit: {ing.unit} · Cost: ₹{ing.unit_cost}/{ing.unit}</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditModal(ing); setEditData({ name: ing.name, unit: ing.unit, current_quantity: ing.current_quantity, minimum_quantity: ing.minimum_quantity, unit_cost: ing.unit_cost }); }} className="text-gray-400 hover:text-blue-500"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteIngredient(ing.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className={`text-2xl font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{ing.current_quantity}</p>
                            <p className="text-xs text-gray-500">
                              Min: {ing.minimum_quantity} {ing.unit}
                              {isLow && <span className="text-red-500 font-semibold ml-1">⚠ LOW</span>}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">Value: ₹{Math.round(ing.current_quantity * ing.unit_cost)}</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setStockModal({ ingredient: ing, type: 'add' }); setStockQty(0); }}
                              className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200" title="Add Stock"><ArrowUpCircle className="w-5 h-5" /></button>
                            <button onClick={() => { setStockModal({ ingredient: ing, type: 'subtract' }); setStockQty(0); }}
                              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="Subtract Stock"><ArrowDownCircle className="w-5 h-5" /></button>
                          </div>
                        </div>
                        {ing.minimum_quantity > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all ${isLow ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(100, (ing.current_quantity / (ing.minimum_quantity * 3)) * 100)}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {filteredIngredients.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No ingredients yet. Click &quot;Add Ingredient&quot; to get started!</p>
                  </div>
                )}
              </div>
            )}

            {/* ==================== RECIPES TAB ==================== */}
            {tab === 'recipes' && (
              <div>
                <p className="text-sm text-gray-500 mb-4">Link ingredients to menu items. When an order is placed, ingredients are auto-deducted.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {menuItems.map(item => {
                    const itemRecipes = recipes.filter(r => r.menu_item_id === item.id);
                    return (
                      <div key={item.id} className="bg-white rounded-xl border p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div><h3 className="font-semibold text-gray-800">{item.name}</h3><p className="text-xs text-gray-500">{item.category} · ₹{item.price}</p></div>
                          <button onClick={() => openRecipeModal(item)} className="text-xs px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 font-medium">
                            {itemRecipes.length > 0 ? 'Edit' : 'Set Recipe'}
                          </button>
                        </div>
                        {itemRecipes.length > 0 ? (
                          <div className="space-y-1 mt-3">{itemRecipes.map(r => (
                            <div key={r.id} className="flex justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                              <span className="text-gray-700">{r.ingredient_name}</span>
                              <span className="text-gray-500 font-mono">{r.quantity_required} {r.ingredient_unit}</span>
                            </div>
                          ))}</div>
                        ) : <p className="text-xs text-gray-400 mt-3 italic">No recipe configured</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==================== HISTORY TAB ==================== */}
            {tab === 'history' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-500">Recent inventory changes</p>
                  <button onClick={() => fetchTransactions()} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
                </div>
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 text-left">
                        <th className="px-4 py-3 font-semibold text-gray-600">Time</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">Ingredient</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">Type</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Change</th>
                        <th className="px-4 py-3 font-semibold text-gray-600">Notes</th>
                      </tr></thead>
                      <tbody>{transactions.map(tx => (
                        <tr key={tx.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(tx.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{tx.ingredient_name || `#${tx.ingredient_id}`}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              tx.transaction_type === 'order_deduction' ? 'bg-blue-100 text-blue-700' : tx.transaction_type === 'manual_add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>{tx.transaction_type === 'order_deduction' ? '🛒 Order' : tx.transaction_type === 'manual_add' ? '➕ Added' : '➖ Removed'}</span>
                          </td>
                          <td className={`px-4 py-3 text-right font-mono font-semibold ${tx.quantity_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{tx.quantity_change >= 0 ? '+' : ''}{tx.quantity_change}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{tx.notes}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  {transactions.length === 0 && <div className="text-center py-12 text-gray-400"><History className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No transactions yet</p></div>}
                </div>
              </div>
            )}

            {/* ==================== DAILY LOG TAB ==================== */}
            {tab === 'daily-log' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                  <p className="text-sm text-gray-500">Daily ingredient usage summary — purchased, used, and order-deducted</p>
                  <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" />
                </div>
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 text-left">
                        <th className="px-4 py-3 font-semibold text-gray-600">Ingredient</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right text-green-600">➕ Added</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right text-red-600">➖ Subtracted</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right text-blue-600">🛒 Order Used</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Net Change</th>
                      </tr></thead>
                      <tbody>
                        {Array.from(logByIngredient.entries()).map(([id, data]) => {
                          const net = data.added - data.deducted - data.orderDeducted;
                          return (
                            <tr key={id} className="border-t hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-800">{data.name}</td>
                              <td className="px-4 py-3 text-right font-mono text-green-600">{data.added > 0 ? `+${data.added}` : '-'}</td>
                              <td className="px-4 py-3 text-right font-mono text-red-600">{data.deducted > 0 ? `-${data.deducted}` : '-'}</td>
                              <td className="px-4 py-3 text-right font-mono text-blue-600">{data.orderDeducted > 0 ? `-${data.orderDeducted}` : '-'}</td>
                              <td className={`px-4 py-3 text-right font-mono font-bold ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{net >= 0 ? '+' : ''}{net}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {logByIngredient.size === 0 && <div className="text-center py-12 text-gray-400"><BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No inventory activity for {logDate}</p></div>}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== ADD INGREDIENT MODAL ==================== */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">Add New Ingredient</h2>
              <div className="space-y-3">
                <div><label className="text-sm font-medium text-gray-700">Name *</label><input type="text" value={newIngredient.name} onChange={e => setNewIngredient(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" placeholder="e.g. Burger Patty" /></div>
                <div><label className="text-sm font-medium text-gray-700">Unit *</label>
                  <select value={newIngredient.unit} onChange={e => setNewIngredient(p => ({ ...p, unit: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none">
                    <option value="pieces">Pieces</option><option value="grams">Grams</option><option value="kg">Kilograms</option><option value="ml">Milliliters</option><option value="liters">Liters</option><option value="cups">Cups</option><option value="tbsp">Tablespoons</option><option value="tsp">Teaspoons</option><option value="slices">Slices</option><option value="packets">Packets</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-xs font-medium text-gray-600">Stock</label><input type="number" min="0" value={newIngredient.current_quantity} onChange={e => setNewIngredient(p => ({ ...p, current_quantity: Number(e.target.value) }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" /></div>
                  <div><label className="text-xs font-medium text-gray-600">Min Qty</label><input type="number" min="0" value={newIngredient.minimum_quantity} onChange={e => setNewIngredient(p => ({ ...p, minimum_quantity: Number(e.target.value) }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" /></div>
                  <div><label className="text-xs font-medium text-gray-600">Cost (₹)</label><input type="number" min="0" step="0.01" value={newIngredient.unit_cost} onChange={e => setNewIngredient(p => ({ ...p, unit_cost: Number(e.target.value) }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" /></div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={handleAddIngredient} className="flex-1 py-2.5 bg-[#1B2E3C] text-white rounded-lg text-sm font-medium hover:bg-[#2a4a5c]">Add Ingredient</button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== EDIT INGREDIENT MODAL ==================== */}
        {editModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">✏️ Edit Ingredient</h2>
              <div className="space-y-3">
                <div><label className="text-sm font-medium text-gray-700">Name</label><input type="text" value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" /></div>
                <div><label className="text-sm font-medium text-gray-700">Unit</label>
                  <select value={editData.unit} onChange={e => setEditData(p => ({ ...p, unit: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none">
                    <option value="pieces">Pieces</option><option value="grams">Grams</option><option value="kg">Kilograms</option><option value="ml">Milliliters</option><option value="liters">Liters</option><option value="cups">Cups</option><option value="tbsp">Tablespoons</option><option value="tsp">Teaspoons</option><option value="slices">Slices</option><option value="packets">Packets</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-xs font-medium text-gray-600">Stock</label><input type="number" min="0" value={editData.current_quantity} onChange={e => setEditData(p => ({ ...p, current_quantity: Number(e.target.value) }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" /></div>
                  <div><label className="text-xs font-medium text-gray-600">Min Qty</label><input type="number" min="0" value={editData.minimum_quantity} onChange={e => setEditData(p => ({ ...p, minimum_quantity: Number(e.target.value) }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" /></div>
                  <div><label className="text-xs font-medium text-gray-600">Cost (₹)</label><input type="number" min="0" step="0.01" value={editData.unit_cost} onChange={e => setEditData(p => ({ ...p, unit_cost: Number(e.target.value) }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" /></div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={handleEditIngredient} className="flex-1 py-2.5 bg-[#1B2E3C] text-white rounded-lg text-sm font-medium hover:bg-[#2a4a5c]">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== STOCK ADJUSTMENT MODAL ==================== */}
        {stockModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setStockModal(null)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-1">{stockModal.type === 'add' ? '➕ Add Stock' : '➖ Subtract Stock'}</h2>
              <p className="text-sm text-gray-500 mb-4">{stockModal.ingredient.name} — Current: {stockModal.ingredient.current_quantity} {stockModal.ingredient.unit}</p>
              <div className="space-y-3">
                <div><label className="text-sm font-medium text-gray-700">Quantity</label><input type="number" min="1" value={stockQty || ''} onChange={e => setStockQty(Number(e.target.value))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" placeholder={`Enter ${stockModal.ingredient.unit}`} autoFocus /></div>
                <div><label className="text-sm font-medium text-gray-700">Notes (optional)</label><input type="text" value={stockNotes} onChange={e => setStockNotes(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" placeholder="e.g. Restocked from supplier" /></div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStockModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={handleStockAdjust} disabled={stockQty <= 0}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium text-white ${stockModal.type === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}>
                  {stockModal.type === 'add' ? 'Add' : 'Subtract'} {stockQty > 0 ? stockQty : ''} {stockModal.ingredient.unit}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== RECIPE MODAL ==================== */}
        {recipeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRecipeModal(null)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-1">📋 Recipe: {recipeModal.name}</h2>
              <p className="text-sm text-gray-500 mb-4">Define ingredients needed per order. Auto-deducted when this item is ordered.</p>
              <div className="space-y-2 mb-4">
                {recipeIngredients.map((ri, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select value={ri.ingredient_id} onChange={e => { const u = [...recipeIngredients]; u[idx].ingredient_id = Number(e.target.value); setRecipeIngredients(u); }}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none">
                      <option value={0}>Select ingredient...</option>
                      {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                    </select>
                    <input type="number" min="0.01" step="0.01" value={ri.quantity_required || ''} onChange={e => { const u = [...recipeIngredients]; u[idx].quantity_required = Number(e.target.value); setRecipeIngredients(u); }}
                      placeholder="Qty" className="w-24 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none" />
                    <button onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:text-red-600"><Minus className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setRecipeIngredients([...recipeIngredients, { ingredient_id: 0, quantity_required: 0 }])}
                className="text-sm text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1 mb-4"><Plus className="w-4 h-4" /> Add Ingredient Row</button>
              <div className="flex gap-3">
                <button onClick={() => setRecipeModal(null)} className="flex-1 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveRecipe} className="flex-1 py-2.5 bg-[#1B2E3C] text-white rounded-lg text-sm font-medium hover:bg-[#2a4a5c]">Save Recipe</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
