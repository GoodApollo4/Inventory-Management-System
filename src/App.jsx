import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Edit2, Trash2, Package, ShoppingCart, Settings, Calendar, LogOut, User, Database, Download, History } from 'lucide-react';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const RestaurantInventoryApp = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('user');
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventoryCounts, setInventoryCounts] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [historicalData, setHistoricalData] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Auth: Check for existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user profile
  const loadUserProfile = async (userId) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setUser(data);
    } else if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('user_profiles').insert([
        {
          id: userId,
          email: userData.user.email,
          role: 'user',
        },
      ]);
      loadUserProfile(userId);
    }
  };

  // Load data from database
  useEffect(() => {
    if (session) {
      loadCategories();
      loadSuppliers();
      loadItems();
    }
  }, [session]);

  const loadCategories = async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    
    if (data && data.length > 0) {
      setCategories(data);
      const expanded = {};
      data.forEach(cat => expanded[cat.id] = true);
      setExpandedCategories(expanded);
    } else {
      // Initialize default categories if none exist
      await initializeCategories();
    }
  };

  const initializeCategories = async () => {
    const defaultCategories = [
      { id: 'protein', name: 'Protein' },
      { id: 'bread', name: 'Bread' },
      { id: 'dairy', name: 'Dairy' },
      { id: 'produce', name: 'Produce' },
      { id: 'frozen', name: 'Frozen' },
      { id: 'dry-goods-dry', name: 'Dry Goods: Dry' },
      { id: 'dry-goods-cans', name: 'Dry Goods: Cans' },
      { id: 'dry-goods-liquids', name: 'Dry Goods: Liquids' },
      { id: 'dry-goods-spices', name: 'Dry Goods: Spices/Herbs' },
      { id: 'dry-goods-servers', name: 'Dry Goods: Servers' },
      { id: 'dry-goods-bar', name: 'Dry Goods: Bar Needs' },
      { id: 'dry-goods-togo', name: 'Dry Goods: TOGO' },
      { id: 'cleaning', name: 'Cleaning Supplies' }
    ];

    const { error } = await supabase.from('categories').insert(defaultCategories);
    if (!error) {
      loadCategories();
    }
  };

  const loadSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select('*').order('name');
    
    if (data && data.length > 0) {
      setSuppliers(data);
    } else {
      // Initialize default suppliers
      await initializeSuppliers();
    }
  };

  const initializeSuppliers = async () => {
    const defaultSuppliers = [
      { id: 'supplier1', name: 'Main Distributor', contact: '', phone: '' },
      { id: 'supplier2', name: 'Produce Supplier', contact: '', phone: '' },
      { id: 'supplier3', name: 'Meat Supplier', contact: '', phone: '' }
    ];

    const { error } = await supabase.from('suppliers').insert(defaultSuppliers);
    if (!error) {
      loadSuppliers();
    }
  };

  const loadItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('name');
    
    if (data) {
      setItems(data);
      // Load most recent inventory counts for each item
      loadLatestCounts(data);
    }
  };

  const loadLatestCounts = async (itemsList) => {
    const counts = {};
    for (const item of itemsList) {
      const { data } = await supabase
        .from('inventory_counts')
        .select('count')
        .eq('item_id', item.id)
        .order('counted_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        counts[item.id] = data.count.toString();
      }
    }
    setInventoryCounts(counts);
  };

  const loadHistoricalData = async () => {
    const { data, error } = await supabase
      .from('inventory_counts')
      .select(`
        *,
        items (name, category, unit)
      `)
      .order('counted_at', { ascending: false })
      .limit(100);
    
    if (data) {
      setHistoricalData(data);
    }
  };

  // Save inventory count
  const saveInventoryCount = async (itemId, count) => {
    const { error } = await supabase.from('inventory_counts').insert([
      {
        item_id: itemId,
        count: parseFloat(count),
        counted_by: user?.email || 'Unknown',
      },
    ]);

    if (error) {
      console.error('Error saving count:', error);
      alert('Error saving inventory count');
    }
  };

  // Save all counts
  const saveAllCounts = async () => {
    const countsToSave = Object.entries(inventoryCounts)
      .filter(([_, count]) => count && count !== '')
      .map(([itemId, count]) => ({
        item_id: itemId,
        count: parseFloat(count),
        counted_by: user?.email || 'Unknown',
      }));

    if (countsToSave.length === 0) {
      alert('No counts to save');
      return;
    }

    const { error } = await supabase.from('inventory_counts').insert(countsToSave);

    if (error) {
      console.error('Error saving counts:', error);
      alert('Error saving inventory counts');
    } else {
      alert(`Successfully saved ${countsToSave.length} inventory counts!`);
    }
  };

  // Handle authentication
  const handleLogin = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    }
  };

  const handleSignUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
    } else {
      alert('Check your email for the confirmation link!');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  // CRUD operations for items
  const handleSaveItem = async (item) => {
    const itemData = {
      ...item,
      week_par: parseFloat(item.week_par || item.weekPar),
      weekend_par: parseFloat(item.weekend_par || item.weekendPar),
      threshold: parseFloat(item.threshold),
      daily_usage: parseFloat(item.daily_usage || item.dailyUsage),
      cost: parseFloat(item.cost || 0),
      updated_at: new Date().toISOString(),
    };

    // Remove old field names if they exist
    delete itemData.weekPar;
    delete itemData.weekendPar;
    delete itemData.dailyUsage;

    const { error } = await supabase
      .from('items')
      .update(itemData)
      .eq('id', item.id);

    if (error) {
      console.error('Error updating item:', error);
      alert('Error updating item');
    } else {
      loadItems();
      setEditingItem(null);
      alert('Item updated successfully!');
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!confirm(`Delete ${itemName}?`)) return;

    const { error } = await supabase.from('items').delete().eq('id', itemId);

    if (error) {
      console.error('Error deleting item:', error);
      alert('Error deleting item');
    } else {
      loadItems();
      alert('Item deleted successfully!');
    }
  };

  // Calculate next truck day
  const getNextTruckDay = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    if (dayOfWeek === 1) return { day: 'Monday', isToday: true, daysUntil: 0, useWeekendPar: false };
    if (dayOfWeek === 4) return { day: 'Thursday', isToday: true, daysUntil: 0, useWeekendPar: true };
    
    if (dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 3) {
      const daysUntil = dayOfWeek === 0 ? 4 : (4 - dayOfWeek);
      return { day: 'Thursday', isToday: false, daysUntil, useWeekendPar: true };
    } else {
      const daysUntil = dayOfWeek === 5 ? 3 : 2;
      return { day: 'Monday', isToday: false, daysUntil, useWeekendPar: false };
    }
  };

  const nextTruck = getNextTruckDay();

  // Calculate item status
  const getItemStatus = (item) => {
    const count = parseFloat(inventoryCounts[item.id] || 0);
    const par = parseFloat(nextTruck.useWeekendPar ? item.weekend_par : item.week_par);
    const threshold = parseFloat(item.threshold);
    const dailyUsage = parseFloat(item.daily_usage);
    
    const projectedStock = count - (dailyUsage * nextTruck.daysUntil);
    const needsOrder = projectedStock < threshold;
    const orderAmount = needsOrder ? Math.max(0, par - count) : 0;
    
    return {
      current: count,
      projected: projectedStock,
      needsOrder,
      orderAmount,
      status: needsOrder ? (nextTruck.daysUntil <= 1 ? 'urgent' : 'order') : 'good'
    };
  };

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const handleInventoryChange = (itemId, value) => {
    setInventoryCounts(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  // Generate order list
  const getOrderList = () => {
    return items
      .map(item => ({
        ...item,
        ...getItemStatus(item)
      }))
      .filter(item => item.needsOrder)
      .sort((a, b) => {
        if (a.status === 'urgent' && b.status !== 'urgent') return -1;
        if (a.status !== 'urgent' && b.status === 'urgent') return 1;
        return a.name.localeCompare(b.name);
      });
  };

  const orderList = getOrderList();

  const totalOrderCost = orderList.reduce((sum, item) => {
    return sum + (item.orderAmount * parseFloat(item.cost || 0));
  }, 0);

  // Export to CSV
  const exportToCSV = () => {
    if (historicalData.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Date', 'Time', 'Item', 'Category', 'Count', 'Unit', 'Counted By'];
    const rows = historicalData.map(record => [
      new Date(record.counted_at).toLocaleDateString(),
      new Date(record.counted_at).toLocaleTimeString(),
      record.items?.name || 'Unknown',
      record.items?.category || '',
      record.count,
      record.items?.unit || '',
      record.counted_by
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Login/Signup Form
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <LoginForm onLogin={handleLogin} onSignUp={handleSignUp} />;
  }

  // Main app interface
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">Chester's Restaurant Inventory</h1>
              <p className="text-sm opacity-90">Welcome, {user?.full_name || user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <div className="bg-white/20 px-4 py-2 rounded-lg">
              <div className="text-sm opacity-90">Next Truck</div>
              <div className="font-bold text-lg">{nextTruck.day} ({nextTruck.daysUntil} days)</div>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-lg">
              <div className="text-sm opacity-90">Items to Order</div>
              <div className="font-bold text-lg">{orderList.length}</div>
            </div>
            {view === 'user' && orderList.length > 0 && (
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                <div className="text-sm opacity-90">Est. Order Cost</div>
                <div className="font-bold text-lg">${totalOrderCost.toFixed(2)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-2 mb-6 inline-flex gap-2 flex-wrap">
          <button
            onClick={() => setView('user')}
            className={`px-6 py-3 rounded-md font-semibold transition-all flex items-center gap-2 ${
              view === 'user' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Package size={20} />
            Take Inventory
          </button>
          
          {user?.role === 'admin' && (
            <button
              onClick={() => setView('admin')}
              className={`px-6 py-3 rounded-md font-semibold transition-all flex items-center gap-2 ${
                view === 'admin' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings size={20} />
              Admin Settings
            </button>
          )}
          
          {view === 'user' && orderList.length > 0 && (
            <button
              onClick={() => setView('orders')}
              className="px-6 py-3 rounded-md font-semibold transition-all flex items-center gap-2 text-gray-600 hover:bg-gray-100"
            >
              <ShoppingCart size={20} />
              View Order List
            </button>
          )}
          
          <button
            onClick={() => {
              setShowHistory(true);
              loadHistoricalData();
            }}
            className="px-6 py-3 rounded-md font-semibold transition-all flex items-center gap-2 text-gray-600 hover:bg-gray-100"
          >
            <History size={20} />
            History
          </button>
        </div>

        {/* Save Counts Button */}
        {view === 'user' && (
          <div className="mb-6">
            <button
              onClick={saveAllCounts}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
            >
              <Database size={20} />
              Save All Counts to Database
            </button>
          </div>
        )}

        {/* User View - Inventory Taking */}
        {view === 'user' && (
          <UserInventoryView
            categories={categories}
            itemsByCategory={itemsByCategory}
            expandedCategories={expandedCategories}
            toggleCategory={toggleCategory}
            inventoryCounts={inventoryCounts}
            handleInventoryChange={handleInventoryChange}
            getItemStatus={getItemStatus}
            nextTruck={nextTruck}
          />
        )}

        {/* Order List View */}
        {view === 'orders' && (
          <OrderListView
            orderList={orderList}
            categories={categories}
            nextTruck={nextTruck}
            totalOrderCost={totalOrderCost}
          />
        )}

        {/* Admin View */}
        {view === 'admin' && user?.role === 'admin' && (
          <AdminView
            items={items}
            categories={categories}
            suppliers={suppliers}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            setEditingItem={setEditingItem}
            handleDeleteItem={handleDeleteItem}
            setShowAddItem={setShowAddItem}
          />
        )}

        {/* Historical Data Modal */}
        {showHistory && (
          <HistoricalDataModal
            historicalData={historicalData}
            onClose={() => setShowHistory(false)}
            onExport={exportToCSV}
          />
        )}

        {/* Edit Item Modal */}
        {editingItem && (
          <EditItemModal
            item={editingItem}
            categories={categories}
            suppliers={suppliers}
            onSave={handleSaveItem}
            onClose={() => setEditingItem(null)}
            onChange={setEditingItem}
          />
        )}
      </div>
    </div>
  );
};

// Login Form Component
const LoginForm = ({ onLogin, onSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSignUp) {
      onSignUp(email, password);
    } else {
      onLogin(email, password);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Chester's Inventory</h1>
          <p className="text-gray-600">{isSignUp ? 'Create your account' : 'Sign in to continue'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

// User Inventory View Component
const UserInventoryView = ({
  categories,
  itemsByCategory,
  expandedCategories,
  toggleCategory,
  inventoryCounts,
  handleInventoryChange,
  getItemStatus,
  nextTruck
}) => {
  return (
    <div className="space-y-4">
      {categories.map(category => {
        const categoryItems = itemsByCategory[category.id] || [];
        if (categoryItems.length === 0) return null;

        return (
          <div key={category.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg">{category.name}</h3>
                <span className="text-sm text-gray-500">({categoryItems.length} items)</span>
              </div>
              <div className="text-sm text-gray-600">
                {categoryItems.filter(item => getItemStatus(item).needsOrder).length} need ordering
              </div>
            </button>

            {expandedCategories[category.id] && (
              <div className="p-4">
                <div className="grid gap-3">
                  {categoryItems.map(item => {
                    const status = getItemStatus(item);
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          status.status === 'urgent'
                            ? 'border-red-500 bg-red-50'
                            : status.status === 'order'
                            ? 'border-yellow-500 bg-yellow-50'
                            : 'border-green-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-semibold text-lg">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              Par: {nextTruck.useWeekendPar ? item.weekend_par : item.week_par} {item.unit}
                              {' • '}Location: {item.location}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <input
                                type="number"
                                step="0.1"
                                value={inventoryCounts[item.id] || ''}
                                onChange={(e) => handleInventoryChange(item.id, e.target.value)}
                                placeholder="Count"
                                className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg text-center text-lg font-bold focus:border-blue-500 focus:outline-none"
                              />
                            </div>

                            <div className="text-right min-w-[120px]">
                              {status.status === 'urgent' && (
                                <div className="text-red-600 font-bold">🔴 ORDER NOW</div>
                              )}
                              {status.status === 'order' && (
                                <div className="text-yellow-600 font-bold">🟡 ORDER {nextTruck.day.toUpperCase()}</div>
                              )}
                              {status.status === 'good' && (
                                <div className="text-green-600 font-bold">🟢 GOOD</div>
                              )}
                              {status.needsOrder && (
                                <div className="text-sm text-gray-600 mt-1">
                                  Order: {status.orderAmount.toFixed(1)} {item.unit}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Order List View Component
const OrderListView = ({ orderList, categories, nextTruck, totalOrderCost }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Order List for {nextTruck.day}</h2>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Print Order List
        </button>
      </div>

      {orderList.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ShoppingCart size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No items need ordering yet!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(category => {
            const categoryOrders = orderList.filter(item => item.category === category.id);
            if (categoryOrders.length === 0) return null;

            return (
              <div key={category.id} className="border-b pb-4">
                <h3 className="font-bold text-lg mb-3 text-gray-700">{category.name}</h3>
                <div className="grid gap-2">
                  {categoryOrders.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          (Current: {item.current} {item.unit})
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600">
                          Order: {item.orderAmount.toFixed(1)} {item.unit}
                        </div>
                        {parseFloat(item.cost) > 0 && (
                          <div className="text-sm text-gray-600">
                            ${(item.orderAmount * parseFloat(item.cost)).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="pt-4 border-t-2">
            <div className="flex justify-between items-center text-xl font-bold">
              <span>Total Estimated Cost:</span>
              <span className="text-blue-600">${totalOrderCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Admin View Component
const AdminView = ({
  items,
  categories,
  suppliers,
  selectedCategory,
  setSelectedCategory,
  setEditingItem,
  handleDeleteItem,
  setShowAddItem
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Item Management</h2>
          <button
            onClick={() => setShowAddItem(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Add New Item
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Filter by Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Item Name</th>
                <th className="px-4 py-3 text-left font-semibold">Category</th>
                <th className="px-4 py-3 text-center font-semibold">Week Par</th>
                <th className="px-4 py-3 text-center font-semibold">Weekend Par</th>
                <th className="px-4 py-3 text-center font-semibold">Daily Use</th>
                <th className="px-4 py-3 text-center font-semibold">Cost</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter(item => selectedCategory === 'all' || item.category === selectedCategory)
                .map(item => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {categories.find(c => c.id === item.category)?.name}
                    </td>
                    <td className="px-4 py-3 text-center">{item.week_par} {item.unit}</td>
                    <td className="px-4 py-3 text-center">{item.weekend_par} {item.unit}</td>
                    <td className="px-4 py-3 text-center">{item.daily_usage} {item.unit}</td>
                    <td className="px-4 py-3 text-center">${item.cost}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id, item.name)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-4">Supplier Management</h2>
        <div className="grid gap-4">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="p-4 border-2 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{supplier.name}</h3>
                  <p className="text-sm text-gray-600">{supplier.contact}</p>
                  <p className="text-sm text-gray-600">{supplier.phone}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Historical Data Modal Component
const HistoricalDataModal = ({ historicalData, onClose, onExport }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">Inventory History</h2>
          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {historicalData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">No historical data yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Time</th>
                  <th className="px-4 py-3 text-left font-semibold">Item</th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-center font-semibold">Count</th>
                  <th className="px-4 py-3 text-left font-semibold">Counted By</th>
                </tr>
              </thead>
              <tbody>
                {historicalData.map(record => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{new Date(record.counted_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{new Date(record.counted_at).toLocaleTimeString()}</td>
                    <td className="px-4 py-3 font-medium">{record.items?.name || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{record.items?.category || ''}</td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {record.count} {record.items?.unit || ''}
                    </td>
                    <td className="px-4 py-3 text-sm">{record.counted_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// Edit Item Modal Component
const EditItemModal = ({ item, categories, suppliers, onSave, onClose, onChange }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Edit Item</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Item Name</label>
            <input
              type="text"
              value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
              <select
                value={item.category}
                onChange={(e) => onChange({ ...item, category: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier</label>
              <select
                value={item.supplier}
                onChange={(e) => onChange({ ...item, supplier: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Week Par (Monday)</label>
              <input
                type="number"
                step="0.1"
                value={item.week_par}
                onChange={(e) => onChange({ ...item, week_par: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Weekend Par (Thursday)</label>
              <input
                type="number"
                step="0.1"
                value={item.weekend_par}
                onChange={(e) => onChange({ ...item, weekend_par: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Reorder Threshold</label>
              <input
                type="number"
                step="0.1"
                value={item.threshold}
                onChange={(e) => onChange({ ...item, threshold: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Daily Usage</label>
              <input
                type="number"
                step="0.1"
                value={item.daily_usage}
                onChange={(e) => onChange({ ...item, daily_usage: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Unit</label>
              <input
                type="text"
                value={item.unit}
                onChange={(e) => onChange({ ...item, unit: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
              <input
                type="text"
                value={item.location}
                onChange={(e) => onChange({ ...item, location: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Unit Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={item.cost}
                onChange={(e) => onChange({ ...item, cost: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(item)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestaurantInventoryApp;
