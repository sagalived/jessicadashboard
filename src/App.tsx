/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  FileUp, Filter, Calendar, Package, TrendingUp, DollarSign, List,
  ChevronRight, Download, Search, LayoutDashboard, Building2, Users, ChevronDown
} from 'lucide-react';
import { format, parse, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, RawTransaction } from './types';
import { INITIAL_DATA } from './data/initialData';

// Design Constants based on the reference image
const THEME = {
  bg: '#0f1120',
  card: '#1b1d3a',
  sidebar: '#0d0f1a',
  accent: '#7c3aed',
  cyan: '#22d3ee',
  amber: '#fbbf24',
  danger: '#f43f5e',
  textMuted: '#94a3b8',
  textMain: '#f1f5f9',
};

const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1'];

export default function App() {
  const [data, setData] = useState<Transaction[]>(INITIAL_DATA);
  const [activeView, setActiveView] = useState<'dashboard' | 'products'>('dashboard');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [storeFilter, setStoreFilter] = useState<string>('Todas');
  const [operatorFilter, setOperatorFilter] = useState<string>('Todos');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCurrency = (val: string): number => {
    if (!val) return 0;
    // Remove R$, spaces, and replace dots (thousands) with empty and comma (decimal) with dot
    const cleaned = val.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parseFlexibleDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    
    // Common formats in CSVs (especially Brazilian ones)
    const formats = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'dd-MM-yyyy'];
    
    for (const fmt of formats) {
      try {
        const parsed = parse(dateStr, fmt, new Date());
        if (!isNaN(parsed.getTime())) return parsed;
      } catch (e) {
        // Continue to next format
      }
    }

    const native = new Date(dateStr);
    return isNaN(native.getTime()) ? new Date() : native;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedData = (results.data as RawTransaction[])
            .map((item, index) => {
              const date = parseFlexibleDate(item["Dt. Transação"] || '');
              return {
                id: index.toString(),
                codEmpresaOrigem: item["Cod. Empresa Origem"] || '',
                dsNomeOperador: item["Ds. Nome Operador"] || '',
                dsEmpresaDestino: item["Ds. Empresa Destino"] || '',
                ds: item["Ds"] || '',
                dsNomeEmpresa: item["Ds. Nome Empresa"] || '',
                dtTransacao: date,
                codOperacao: item["Cod. Operação"] || '',
                dsOperacao: item["Ds. Operação"] || '',
                nrTransacao: item["Nr. Transação"] || '',
                codProduto: item["Cod. Produto"] || '',
                dsProduto: item["Ds. Produto"] || '',
                qtSolicitada: parseInt(item["Qt. Solicitada"] || '0'),
                vlUnitbruto: parseCurrency(item["Vl. Unitbruto"] || '0'),
                tpSituacaodes: item["Tp. Situaçãodes"] || '',
                dsValorTotal: parseCurrency(item["Ds. Valor Total"] || '0'),
              };
            })
            // Filter out obviously invalid data if needed, but ensure dates are valid
            .filter(item => !isNaN(item.dtTransacao.getTime()));
          
          setData(parsedData);
        },
      });
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesCategory = categoryFilter === 'All' || item.dsProduto === categoryFilter;
      const matchesStore = storeFilter === 'Todas' || item.dsNomeEmpresa === storeFilter;
      const matchesOperator = operatorFilter === 'Todos' || item.dsNomeOperador === operatorFilter;
      
      let matchesDate = true;
      if (dateFilter.start && dateFilter.end) {
        try {
          const startDate = new Date(dateFilter.start);
          const endDate = new Date(dateFilter.end);
          
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const start = startOfDay(startDate);
            const end = endOfDay(endDate);
            matchesDate = isWithinInterval(item.dtTransacao, { start, end });
          }
        } catch (e) {
          matchesDate = true; // Fallback to showing everything if filter dates are broken
        }
      }

      return matchesCategory && matchesDate && matchesStore && matchesOperator;
    });
  }, [data, categoryFilter, dateFilter, storeFilter, operatorFilter]);

  const stats = useMemo(() => {
    const totalValue = filteredData.reduce((acc, curr) => acc + curr.dsValorTotal, 0);
    const totalVolume = filteredData.reduce((acc, curr) => acc + curr.qtSolicitada, 0);
    const avgValue = filteredData.length > 0 ? totalValue / filteredData.length : 0;
    
    // Group by date for the line chart
    const dailyData: Record<string, { value: number, volume: number }> = {};
    filteredData.forEach(item => {
      const d = format(item.dtTransacao, 'yyyy-MM-dd');
      if (!dailyData[d]) dailyData[d] = { value: 0, volume: 0 };
      dailyData[d].value += item.dsValorTotal;
      dailyData[d].volume += item.qtSolicitada;
    });
    const trendData = Object.entries(dailyData)
      .map(([date, s]) => ({ date, value: s.value, volume: s.volume }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by product for the pie chart
    const productData: Record<string, number> = {};
    filteredData.forEach(item => {
      productData[item.dsProduto] = (productData[item.dsProduto] || 0) + 1;
    });
    const categoryData = Object.entries(productData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { totalValue, totalVolume, avgValue, trendData, categoryData };
  }, [filteredData]);

  const categories = useMemo(() => {
    const cats = new Set(data.map(item => item.dsProduto));
    return ['All', ...Array.from(cats)].sort();
  }, [data]);

  const stores = useMemo(() => {
    const s = new Set(data.map(item => item.dsNomeEmpresa));
    return ['Todas', ...Array.from(s)].sort();
  }, [data]);

  const operators = useMemo(() => {
    const op = new Set(data.map(item => item.dsNomeOperador));
    return ['Todos', ...Array.from(op)].sort();
  }, [data]);

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const exportToCSV = (dataToExport: Transaction[], filename: string) => {
    if (dataToExport.length === 0) return;
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen font-sans text-slate-200 flex" style={{ backgroundColor: THEME.bg }}>
      {/* Sidebar */}
      <div className="w-16 md:w-64 border-r border-slate-800 hidden md:flex flex-col p-4 bg-slate-950/50 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <LayoutDashboard size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white hidden md:block">JessicaDashboard</h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard ao vivo" 
            active={activeView === 'dashboard'} 
            onClick={() => setActiveView('dashboard')}
          />
          <SidebarItem 
            icon={<Package size={20} />} 
            label="Produtos" 
            active={activeView === 'products'}
            onClick={() => setActiveView('products')}
          />
          <SidebarItem icon={<FileUp size={20} />} label="Importar planilha" onClick={triggerFileUpload} />
        </nav>

        <div className="mt-auto space-y-3">
          <button 
            onClick={triggerFileUpload}
            className="w-full flex items-center justify-center gap-2 p-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-slate-300 rounded-xl transition-all shadow-lg font-medium text-sm"
          >
            <FileUp size={18} />
            <span className="hidden md:inline">Import Planilha</span>
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv" 
            className="hidden" 
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-20">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-indigo-600/10 border border-indigo-500/20 rounded-full text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              Live Feed
            </div>
            <h2 className="text-sm font-bold text-slate-400">JessicaDashboard v2.0</h2>
          </div>
          <button 
            onClick={() => exportToCSV(filteredData, 'dashboard_export')}
            disabled={filteredData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/10 font-bold text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>

        {activeView === 'dashboard' ? (
          <DashboardView 
            stats={stats}
            filteredData={filteredData}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            categories={categories}
            storeFilter={storeFilter}
            setStoreFilter={setStoreFilter}
            stores={stores}
            operatorFilter={operatorFilter}
            setOperatorFilter={setOperatorFilter}
            operators={operators}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            triggerFileUpload={triggerFileUpload}
            setSelectedTransaction={setSelectedTransaction}
            exportToCSV={exportToCSV}
          />
        ) : (
          <ProductsView 
            data={filteredData} 
            selectedProduct={selectedProduct} 
            setSelectedProduct={setSelectedProduct}
            setSelectedTransaction={setSelectedTransaction}
          />
        )}
      </main>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTransaction(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#1b1d3a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl pointer-events-auto"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-xl font-bold text-white tracking-tight">Detalhes do Registro</h3>
                <button 
                  onClick={() => setSelectedTransaction(null)}
                  className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                >
                  <Search size={20} className="rotate-45" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Número da Transação</label>
                    <div className="text-sm font-bold text-indigo-400 font-mono tracking-wider">{selectedTransaction.nrTransacao}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Data e Hora</label>
                    <div className="text-sm font-bold text-white">{format(selectedTransaction.dtTransacao, 'dd/MM/yyyy HH:mm')}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Operador Responsável</label>
                    <div className="text-sm font-bold text-white">{selectedTransaction.dsNomeOperador}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Loja / Empresa Origem</label>
                    <div className="text-sm font-bold text-slate-300 capitalize">{selectedTransaction.dsNomeEmpresa}</div>
                    <div className="text-[9px] text-slate-600 font-mono">Cod: {selectedTransaction.codEmpresaOrigem}</div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-inner">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-tight text-indigo-400/70 block">Produto</label>
                      <div className="text-sm font-bold text-white leading-snug">{selectedTransaction.dsProduto}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{selectedTransaction.codProduto}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-800/50 pt-4">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Qtd Solicitada</div>
                      <span className="text-3xl font-black text-white">{selectedTransaction.qtSolicitada}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Valor Total</div>
                      <div className="text-2xl font-black text-emerald-400">{formatCurrency(selectedTransaction.dsValorTotal)}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-indigo-600/5 p-4 rounded-xl border border-indigo-500/10">
                    <label className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest block mb-1">Operação</label>
                    <div className="text-xs font-bold text-slate-200 capitalize">{selectedTransaction.dsOperacao}</div>
                    <div className="text-[9px] text-slate-500 font-mono">ID: {selectedTransaction.codOperacao}</div>
                  </div>
                  <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
                    <label className="text-[10px] font-black text-amber-400/80 uppercase tracking-widest block mb-1">Situação / Status</label>
                    <div className={`text-xs font-bold ${selectedTransaction.tpSituacaodes.toLowerCase().includes('ok') ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {selectedTransaction.tpSituacaodes}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end">
                <button 
                  onClick={() => setSelectedTransaction(null)}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/10 font-black text-xs uppercase tracking-widest"
                >
                  OK / Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer mimic */}
      <footer className="fixed bottom-0 left-0 right-0 h-12 bg-slate-950/80 backdrop-blur-md border-t border-slate-800 px-8 flex items-center justify-between z-50 pointer-events-none md:pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
             <LayoutDashboard size={10} className="text-white" />
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Control / Center</span>
        </div>
        <div className="flex items-center gap-6">
           <div className="hidden md:flex gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span className="text-indigo-400 cursor-pointer">Support</span>
              <span className="cursor-pointer hover:text-white transition-colors">Documentation</span>
              <span className="cursor-pointer hover:text-white transition-colors">Status</span>
           </div>
           <div className="text-sm font-medium text-slate-400 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
             {format(new Date(), 'HH:mm')}
           </div>
        </div>
      </footer>
    </div>
  );
}

function CustomDropdown({ label, value, options, onChange, icon: Icon, iconColor }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-[#1b1d3a] border border-slate-800 rounded-2xl px-4 py-2 shadow-lg hover:border-indigo-500/50 transition-all cursor-pointer group select-none"
      >
        <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
           {Icon && <Icon size={16} className={iconColor || "text-indigo-400"} />}
           <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider whitespace-nowrap">{label}</span>
        </div>
        <div className="flex items-center justify-between gap-2 min-w-[120px]">
          <span className="text-sm font-bold text-white truncate max-w-[150px]">{value}</span>
          <ChevronDown size={14} className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-0 z-[100] w-full mt-2 bg-[#1b1d3a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
              {options.map((opt: string) => (
                <div 
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className={`px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-all ${value === opt ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  {opt}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardView({ 
  stats, filteredData, categoryFilter, setCategoryFilter, categories, 
  storeFilter, setStoreFilter, stores,
  operatorFilter, setOperatorFilter, operators,
  dateFilter, setDateFilter, triggerFileUpload, setSelectedTransaction, exportToCSV 
}: any) {
  return (
    <>
      {/* Header / Selection Bar */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-stretch sm:items-center gap-3">
          {/* Quick Company Selector */}
          <CustomDropdown 
            label="Empresa"
            value={storeFilter}
            options={stores}
            onChange={setStoreFilter}
            icon={Building2}
          />

          {/* Quick Operator Selector */}
          <CustomDropdown 
            label="Operador"
            value={operatorFilter}
            options={operators}
            onChange={setOperatorFilter}
            icon={Users}
            iconColor="text-cyan-400"
          />

          {/* Export Specific Data */}
          {(storeFilter !== 'Todas' || operatorFilter !== 'Todos') && (
            <button 
              onClick={() => {
                const prefix = storeFilter !== 'Todas' ? `loja_${storeFilter}` : `operador_${operatorFilter}`;
                exportToCSV(filteredData, `export_${prefix.toLowerCase().replace(/\s+/g, '_')}`);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl transition-all shadow-lg shadow-emerald-500/10 font-black text-[10px] uppercase tracking-widest"
            >
              <Download size={14} />
              Exportar Seleção
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-900/50 border border-slate-800 rounded-xl p-1 gap-1">
            <FilterItem active>Dia</FilterItem>
            <FilterItem>Semana</FilterItem>
            <FilterItem>Mês</FilterItem>
          </div>
        </div>
      </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Main Stat 1: Total Value */}
          <MetricCard 
            title="Receita Total" 
            value={formatCurrency(stats.totalValue)} 
            icon={<DollarSign className="text-emerald-400" size={24} />}
            colSpan="col-span-1 sm:col-span-3"
            trend="+12% vs mês anterior"
            detail="Volume financeiro processado"
          />

          {/* Main Stat 2: Total Volume */}
          <MetricCard 
            title="Quantidade Total" 
            value={stats.totalVolume.toLocaleString('pt-BR')} 
            icon={<TrendingUp className="text-cyan-400" size={24} />}
            colSpan="col-span-1 sm:col-span-3"
            trend="+5.4%"
            detail="Quantidade solicitada"
          />

        {/* Main Chart Section: Sales Trend */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 bg-[#1b1d3a] border border-slate-800 rounded-3xl p-8 flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Vendas e Estoque por Loja</h2>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-400"></div> Vendas</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Quantidade (Status/Ref)</div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 overflow-hidden">
                <span className="text-slate-500 font-bold">LOJA:</span>
                <select 
                  className="bg-transparent border-none outline-none text-indigo-400 font-bold cursor-pointer"
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                >
                  {stores.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.trendData.slice(-15)}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#2a2e45" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} 
                  tickFormatter={(val) => format(new Date(val), 'dd/MM')}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 10}} 
                  tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                />
                <Tooltip 
                  cursor={{fill: 'rgba(124, 58, 237, 0.05)'}}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} 
                  formatter={(value: number, name: string) => {
                    if (name.includes('Receita')) return [formatCurrency(value), name];
                    return [formatNumber(value), name];
                  }}
                />
                <Bar dataKey="value" name="Receita (R$)" fill={THEME.cyan} radius={[4, 4, 0, 0]} barSize={15} />
                <Bar dataKey="volume" name="Vendas (Qtd/Estoque)" fill={THEME.amber} radius={[4, 4, 0, 0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-2 bg-[#1b1d3a] border border-slate-800 rounded-3xl p-8 flex flex-col h-[450px]">
          <h2 className="text-xl font-bold text-white mb-6">Feedback do Mercado</h2>
          <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            {filteredData.slice(0, 10).map((item: any, i: number) => (
              <div key={i} className="flex gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <DollarSign size={20} />
                </div>
                <div className="flex-1 border-b border-slate-800 pb-4 group-last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-bold text-slate-200 truncate pr-4">{item.dsNomeEmpresa}</h4>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">{format(item.dtTransacao, 'HH:mm')}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 italic">“Pedido de {item.dsProduto} concluído por {item.dsNomeOperador}”</p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 flex justify-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="col-span-1 md:col-span-6 bg-[#1b1d3a] border border-slate-800 rounded-2xl p-4 lg:p-6 flex flex-col lg:flex-row items-stretch lg:items-center gap-6 shadow-xl">
          <div className="flex items-center gap-3 border-b lg:border-b-0 lg:border-r border-slate-800 pb-4 lg:pb-0 lg:pr-6">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Filter size={18} className="text-indigo-400" />
            </div>
            <span className="text-sm font-black uppercase tracking-widest text-slate-200">Refinar Dados</span>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Filtrar por Empresa</label>
              <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all">
                <select 
                  className="bg-transparent border-none outline-none text-indigo-400 font-bold cursor-pointer text-xs w-full"
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                >
                  {stores.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button 
                  onClick={() => exportToCSV(filteredData.filter(i => storeFilter === 'Todas' || i.dsNomeEmpresa === storeFilter), `export_empresa_${storeFilter.toLowerCase().replace(/\s+/g, '_')}`)}
                  className="p-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition-all"
                  title="Exportar dados desta empresa"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Categoria de Produto</label>
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 w-full">
                <select 
                  className="bg-transparent border-none outline-none text-indigo-400 font-bold cursor-pointer text-xs w-full"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Intervalo de Datas</label>
              <div className="flex bg-slate-900/80 border border-slate-800 rounded-xl p-1 gap-1">
                <div className="flex-1 flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">De:</span>
                  <input 
                    type="date" 
                    className="bg-transparent border-none outline-none appearance-none text-[10px] text-white font-bold w-full"
                    value={dateFilter.start}
                    onChange={(e) => setDateFilter((prev: any) => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="flex-1 flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Até:</span>
                  <input 
                    type="date" 
                    className="bg-transparent border-none outline-none text-[10px] text-white font-bold w-full"
                    value={dateFilter.end}
                    onChange={(e) => setDateFilter((prev: any) => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex lg:flex-col items-center justify-center gap-1 border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Resultados</div>
            <div className="text-xl font-black text-white">{filteredData.length}</div>
          </div>
        </div>

        {/* Data List */}
        <div className="col-span-1 md:col-span-6 bg-[#1b1d3a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-slate-800">
             <h2 className="text-xl font-bold tracking-tight">Agentes Ativos / Registros</h2>
          </div>
          <table className="w-full text-left text-sm whitespace-nowrap">
             <thead className="bg-slate-900/50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="px-8 py-5">Nome do Operador</th>
                  <th className="px-8 py-5">Produto</th>
                  <th className="px-8 py-5">Quantidade</th>
                  <th className="px-8 py-5 text-right">Status</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-800/50">
                {filteredData.slice(0, 15).map((row: any) => (
                  <tr 
                    key={row.id} 
                    onClick={() => setSelectedTransaction(row)}
                    className="hover:bg-slate-800/20 transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-4">
                      <div className="flex flex-col">
                         <span className="font-bold text-slate-200">{row.dsNomeOperador}</span>
                         <span className="text-[10px] text-slate-500">{row.dsNomeEmpresa}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                       <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-lg text-xs font-medium">{row.dsProduto}</span>
                    </td>
                    <td className="px-8 py-4 font-bold">{row.qtSolicitada}</td>
                    <td className="px-8 py-4 text-right">
                       <span className={`text-xs font-bold ${row.tpSituacaodes.toLowerCase().includes('ok') ? 'text-emerald-400' : 'text-amber-400'}`}>
                         {row.tpSituacaodes || 'Ativo'}
                       </span>
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="p-20 flex flex-col items-center justify-center text-slate-500">
              <FileUp size={48} className="opacity-20 mb-4" />
              <p>Nenhum dado importado. Importe um CSV para ver os registros aqui.</p>
              <button 
                onClick={triggerFileUpload}
                className="mt-4 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-xl transition-all font-bold uppercase text-[10px] tracking-widest"
              >
                Upload Planilha
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ProductsView({ data, selectedProduct, setSelectedProduct, setSelectedTransaction }: any) {
  const products = useMemo(() => {
    const list: Record<string, { count: number; total: number; volume: number; code: string }> = {};
    data.forEach((item: any) => {
      if (!list[item.dsProduto]) list[item.dsProduto] = { count: 0, total: 0, volume: 0, code: item.codProduto };
      list[item.dsProduto].count += 1;
      list[item.dsProduto].total += item.dsValorTotal;
      list[item.dsProduto].volume += item.qtSolicitada;
    });
    return Object.entries(list)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const productDetails = useMemo(() => {
    if (!selectedProduct) return [];
    return data.filter((item: any) => item.dsProduto === selectedProduct);
  }, [data, selectedProduct]);

  const productStats = useMemo(() => {
    if (productDetails.length === 0) return null;
    const total = productDetails.reduce((acc: number, curr: any) => acc + curr.dsValorTotal, 0);
    const volume = productDetails.reduce((acc: number, curr: any) => acc + curr.qtSolicitada, 0);
    
    // Daily trend for this product
    const daily: Record<string, number> = {};
    productDetails.forEach((item: any) => {
      const d = format(item.dtTransacao, 'yyyy-MM-dd');
      daily[d] = (daily[d] || 0) + item.dsValorTotal;
    });
    const trend = Object.entries(daily)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { total, volume, trend };
  }, [productDetails]);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Catálogo de Produtos & Análises</h2>
          <p className="text-slate-500 text-sm">Visão geral dos produtos e detalhes das transações</p>
        </div>
        {selectedProduct && (
          <button 
            onClick={() => setSelectedProduct(null)}
            className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-[10px] tracking-widest hover:text-indigo-300"
          >
            Voltar para a Lista <ChevronRight size={14} className="rotate-180" />
          </button>
        )}
      </header>

      {!selectedProduct ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <motion.div 
              layoutId={product.name}
              key={product.name}
              onClick={() => setSelectedProduct(product.name)}
              className="bg-[#1b1d3a] border border-slate-800 rounded-3xl p-6 hover:border-indigo-500/50 cursor-pointer transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Package size={20} />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{product.code}</div>
              </div>
              <h3 className="text-lg font-bold mb-1 truncate">{product.name}</h3>
              <div className="flex justify-between text-xs text-slate-500 mb-6">
                <span>{product.count} Transações</span>
                <span>{product.volume} Unidades</span>
              </div>
              <div className="text-2xl font-bold text-white mb-4">{formatCurrency(product.total)}</div>
              <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: '45%' }}></div>
              </div>
            </motion.div>
          ))}
          {products.length === 0 && (
             <div className="col-span-full py-20 text-center text-slate-600">Nenhum produto encontrado. Importe dados para vê-los aqui.</div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
           {/* Detailed view for a single product */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <MetricCard 
                title={`${selectedProduct} - Receita`}
                value={formatCurrency(productStats?.total || 0)}
                icon={<DollarSign size={24} className="text-emerald-400" />}
                colSpan="col-span-1"
              />
              <MetricCard 
                title="Volume Vendido"
                value={(productStats?.volume || 0).toLocaleString('pt-BR')}
                icon={<Package size={24} className="text-cyan-400" />}
                colSpan="col-span-1"
              />
              <div className="bg-[#1b1d3a] border border-slate-800 rounded-3xl p-6 h-[180px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={productStats?.trend}>
                       <Tooltip 
                         contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                         formatter={(value: number) => [formatCurrency(value), "Receita"]}
                       />
                       <Line type="monotone" dataKey="value" stroke={THEME.cyan} strokeWidth={3} dot={false} />
                    </LineChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Full Detail Table */}
           <div className="bg-[#1b1d3a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-800 flex justify-between items-end">
                <div>
                   <h3 className="text-xl font-bold text-white mb-1">Detalhes da Transação</h3>
                   <p className="text-sm text-slate-500 italic">Informações detalhadas para "{selectedProduct}"</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center px-4">
                    <div className="text-lg font-bold">{productDetails.length}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Entradas</div>
                  </div>
                </div>
              </div>
           <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1000px] lg:min-w-full">
                   <thead className="bg-slate-900/50 text-slate-500 font-bold uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-4 first:rounded-tl-xl">Nr. Transação</th>
                        <th className="px-4 py-4">Dt. Transação</th>
                        <th className="px-4 py-4">Empresa</th>
                        <th className="px-4 py-4 text-center">Orig/Dest</th>
                        <th className="px-4 py-4">Operador</th>
                        <th className="px-4 py-4 text-center">Operação</th>
                        <th className="px-4 py-4 text-center">Qt.</th>
                        <th className="px-4 py-4 text-right">Vl. Unit</th>
                        <th className="px-4 py-4 text-right">Total</th>
                        <th className="px-4 py-4 text-center last:rounded-tr-xl">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50">
                      {productDetails.map((row: any) => (
                        <tr 
                          key={row.id} 
                          onClick={() => setSelectedTransaction(row)}
                          className="hover:bg-slate-800/20 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-4 font-mono font-bold text-indigo-400 text-xs">{row.nrTransacao}</td>
                          <td className="px-4 py-4 text-slate-400">{format(row.dtTransacao, 'dd/MM/yy HH:mm')}</td>
                          <td className="px-4 py-4">
                             <div className="font-bold text-slate-200">{row.dsNomeEmpresa}</div>
                             <div className="text-[9px] text-slate-500">Cod: {row.codEmpresaOrigem}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                             <div className="flex flex-col text-[10px]">
                                <span className="text-cyan-400">O: {row.codEmpresaOrigem}</span>
                                <span className="text-amber-400 font-mono">D: {row.dsEmpresaDestino}</span>
                             </div>
                          </td>
                          <td className="px-4 py-4 text-slate-200 text-xs max-w-[150px] truncate">{row.dsNomeOperador}</td>
                          <td className="px-4 py-4 text-center">
                             <div className="font-bold text-indigo-400 text-[10px]">{row.codOperacao}</div>
                             <div className="text-[9px] text-slate-500 truncate max-w-[100px]">{row.dsOperacao}</div>
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-white text-xs">{row.qtSolicitada}</td>
                          <td className="px-4 py-4 text-right text-slate-400 text-xs">{formatCurrency(row.vlUnitbruto)}</td>
                          <td className="px-4 py-4 text-right font-black text-white text-xs whitespace-nowrap">{formatCurrency(row.dsValorTotal)}</td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${row.tpSituacaodes.toLowerCase().includes('ok') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                              {row.tpSituacaodes}
                            </span>
                          </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group ${active ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
    >
      <span className={active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400 transition-colors'}>
        {icon}
      </span>
      <span className="text-sm font-medium hidden md:block">{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"></div>}
    </div>
  );
}

function MetricCard({ title, value, icon, colSpan, trend, detail }: { title: string, value: string, icon: React.ReactNode, colSpan: string, trend?: string, detail?: string }) {
  return (
    <div className={`${colSpan} bg-[#1b1d3a] border border-slate-800 rounded-3xl p-6 relative overflow-hidden group`}>
      <div className="flex justify-between items-start mb-6">
        <span className="text-slate-400 font-medium text-sm tracking-tight">{title}</span>
        <div className="bg-slate-900/50 p-2.5 rounded-2xl border border-slate-800 group-hover:border-indigo-500/30 transition-all duration-500">
          {icon}
        </div>
      </div>
      <div className="space-y-1 relative z-10">
        <div className="text-4xl font-bold tracking-tight text-white">{value}</div>
        <div className="flex items-center gap-2">
          {trend && <span className="text-emerald-400 text-xs font-bold">{trend}</span>}
          {detail && <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{detail}</span>}
        </div>
      </div>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-1 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
         {icon}
      </div>
    </div>
  );
}

function FilterItem({ children, active = false }: { children: React.ReactNode, active?: boolean }) {
  return (
    <button className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${active ? 'bg-indigo-600 text-indigo-50' : 'text-slate-500 hover:text-slate-300'}`}>
      {children}
    </button>
  );
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatNumber(val: number) {
  return new Intl.NumberFormat('pt-BR').format(val);
}
