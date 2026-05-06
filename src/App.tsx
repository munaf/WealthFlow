/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PieChart, 
  Calendar, 
  Plus, 
  Trash2, 
  AlertCircle,
  ArrowRight,
  Info,
  Copy,
  Save,
  Download,
  FileUp,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  ReferenceLine,
  Label
} from 'recharts';
import { FinancialItem, FinancialItemType, Frequency, AssetType, UserProfile, SimulationResult, Scenario } from './types';
import { runSimulation } from './lib/modeling';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_PROFILE: UserProfile = {
  currentAge: 40,
  retirementAge: 65,
  lifeExpectancy: 95,
  initialNetWorth: 50000,
  residenceState: 'CA',
};

const INITIAL_ITEMS: FinancialItem[] = [
  {
    id: '1',
    title: 'Salary',
    type: FinancialItemType.INCOME,
    value: 120000,
    frequency: Frequency.ANNUAL,
    growthRate: 0.03,
    startAge: 40,
    endAge: 65,
  },
  {
    id: '2',
    title: 'Living Expenses',
    type: FinancialItemType.EXPENSE,
    value: 3000,
    frequency: Frequency.MONTHLY,
    growthRate: 0.02,
    startAge: 40,
    endAge: 95,
  },
  {
    id: '3',
    title: 'Savings Account',
    type: FinancialItemType.ASSET,
    assetType: AssetType.CASH,
    value: 50000,
    growthRate: 0.04,
    startAge: 40,
    endAge: 95,
    isLiquid: true,
  }
];

const TooltipLabel = ({ children, tooltip, isDarkMode }: { children: React.ReactNode, tooltip: string, isDarkMode: boolean }) => (
  <div className="group/label relative mb-1.5">
    <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1 cursor-help">
      {children}
      <Info className="w-2.5 h-2.5 opacity-40 group-hover/label:opacity-100 transition-opacity" />
    </label>
    <div className={cn(
      "absolute top-full left-0 mt-1 w-56 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/label:opacity-100 transition-all z-50 normal-case font-normal shadow-2xl border border-white/10 scale-95 origin-top-left group-hover/label:scale-100",
      isDarkMode ? "bg-gray-800" : "bg-gray-900"
    )}>
      {tooltip}
    </div>
  </div>
);

export default function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    const saved = localStorage.getItem('wealthflow_scenarios');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [items, setItems] = useState<FinancialItem[]>(INITIAL_ITEMS);
  const [inflationRate, setInflationRate] = useState(0.03);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isNamingNew, setIsNamingNew] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wealthflow_darkmode');
      return saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  React.useEffect(() => {
    localStorage.setItem('wealthflow_darkmode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    scenarios: true,
    parameters: true,
    assets: true,
    debts: false,
    income: true,
    expenses: true,
    one_time_expenses: true
  });

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  React.useEffect(() => {
    if (saveSuccess) {
      const t = setTimeout(() => setSaveSuccess(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saveSuccess]);

  // Auto-save effect
  React.useEffect(() => {
    if (activeScenarioId) {
      const timer = setTimeout(() => {
        const scenario = scenarios.find(s => s.id === activeScenarioId);
        if (scenario) {
          saveScenario(scenario.name, true);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [profile, items, inflationRate, activeScenarioId]);

  // Sync to localStorage
  React.useEffect(() => {
    localStorage.setItem('wealthflow_scenarios', JSON.stringify(scenarios));
  }, [scenarios]);

  const clone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

  const generateId = () => {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
    } catch (e) {
      console.warn('crypto.randomUUID failed:', e);
    }
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  };

  const saveScenario = (name: string = '', isAuto: boolean = false) => {
    try {
      const defaultName = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      const scenarioName = name || (activeScenarioId ? scenarios.find(s => s.id === activeScenarioId)?.name : '') || defaultName;
      const id = activeScenarioId || generateId();
      
      const newScenario: Scenario = {
        id,
        name: scenarioName,
        profile: clone(profile),
        items: clone(items),
        inflationRate,
        updatedAt: Date.now()
      };

      setScenarios(prev => {
        const index = prev.findIndex(s => s.id === id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = newScenario;
          return updated;
        } else {
          return [...prev, newScenario];
        }
      });

      setActiveScenarioId(id);
      if (!isAuto) setSaveSuccess(true);
    } catch (err) {
      console.error('Failed to save scenario:', err);
    }
  };

  const startNewScenario = () => {
    const defaultName = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const name = prompt("Enter a name for your new scenario:", defaultName);
    
    if (name !== null) {
      setActiveScenarioId(null);
      // Reset state first
      setProfile(clone(DEFAULT_PROFILE));
      setItems(clone(INITIAL_ITEMS));
      setInflationRate(0.03);
      
      // Then save it with the new name to generate ID and add to list
      const id = generateId();
      const newScenario: Scenario = {
        id,
        name: name || defaultName,
        profile: clone(DEFAULT_PROFILE),
        items: clone(INITIAL_ITEMS),
        inflationRate: 0.03,
        updatedAt: Date.now()
      };
      
      setScenarios(prev => [...prev, newScenario]);
      setActiveScenarioId(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleExportCSV = () => {
    try {
      const header = [
        'Title', 'Type', 'AssetType', 'Value', 'Frequency', 'GrowthRate', 
        'StartAge', 'EndAge', 'IsLiquid', 'SurplusAssetId', 'IsTodayDollars',
        'ProfileAge', 'ProfileRetire', 'ProfileLife', 'ProfileInitialNW', 'ResidenceState', 'Inflation'
      ];
      
      const rows = items.map(item => [
        `"${(item.title || '').replace(/"/g, '""')}"`,
        item.type,
        item.assetType || '',
        item.value,
        item.frequency || '',
        item.growthRate,
        item.startAge,
        item.endAge,
        item.isLiquid ? 'true' : 'false',
        item.surplusAssetId || '',
        item.isTodayDollars !== undefined ? (item.isTodayDollars ? 'true' : 'false') : '',
        profile.currentAge,
        profile.retirementAge,
        profile.lifeExpectancy,
        profile.initialNetWorth,
        profile.residenceState || 'CA',
        inflationRate
      ]);

      const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const baseName = activeScenarioId ? scenarios.find(s => s.id === activeScenarioId)?.name : 'WealthFlow_Config';
      link.download = `${baseName}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Revoke after a delay to ensure the browser starts the download
      setTimeout(() => URL.revokeObjectURL(url), 150);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
        if (lines.length < 2) {
          alert('Invalid CSV file: No data rows found.');
          return;
        }

        const rows = lines.slice(1);
        const newItems: FinancialItem[] = [];
        let newProfile = { ...profile };
        let newInflation = inflationRate;

        rows.forEach((line, idx) => {
          const cleaned = line.split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          
          if (cleaned.length < 15) return;

          const [
            title, type, assetType, value, frequency, growthRate, 
            startAge, endAge, isLiquid, surplusAssetId, isTodayDollars,
            pAge, pRetire, pLife, pNW, pStateOrInflation, pInflationIfState
          ] = cleaned;

          if (idx === 0) {
            // Newest format: 17 cols (added IsTodayDollars)
            // Mid format: 16 cols (added ResidenceState)
            // Old format: 15 cols 
            const hasTodayDollarsField = cleaned.length >= 17;
            const hasStateField = cleaned.length >= 16;
            
            newProfile = {
              currentAge: parseInt(hasTodayDollarsField ? pAge : (hasStateField ? pAge : pAge)) || profile.currentAge, // This logic is slightly messy because of shifting indexes
              retirementAge: 0, // We'll re-extract properly below
              lifeExpectancy: 0,
              initialNetWorth: 0,
              residenceState: 'CA'
            };

            // Let's re-map based on count to be safer
            let profileBaseIdx = 10; // Old format
            if (cleaned.length >= 17) profileBaseIdx = 11;
            else if (cleaned.length >= 16) profileBaseIdx = 10;
            
            newProfile = {
              currentAge: parseInt(cleaned[profileBaseIdx]) || profile.currentAge,
              retirementAge: parseInt(cleaned[profileBaseIdx + 1]) || profile.retirementAge,
              lifeExpectancy: parseInt(cleaned[profileBaseIdx + 2]) || profile.lifeExpectancy,
              initialNetWorth: parseFloat(cleaned[profileBaseIdx + 3]) || profile.initialNetWorth,
              residenceState: cleaned.length >= 16 ? cleaned[profileBaseIdx + 4] : 'CA'
            };
            newInflation = parseFloat(cleaned[cleaned.length - 1]) || inflationRate;
          }

          newItems.push({
            id: generateId(),
            title: title || 'Imported Item',
            type: type as any,
            assetType: assetType as any || undefined,
            value: parseFloat(value) || 0,
            frequency: frequency as any || undefined,
            growthRate: parseFloat(growthRate) || 0,
            startAge: parseInt(startAge) || profile.currentAge,
            endAge: parseInt(endAge) || profile.lifeExpectancy,
            isLiquid: isLiquid === 'true',
            surplusAssetId: surplusAssetId || undefined,
            isTodayDollars: isTodayDollars === 'true' || (type === FinancialItemType.ONE_TIME_EXPENSE && isTodayDollars !== 'false')
          });
        });

        if (newItems.length > 0) {
          setProfile(newProfile);
          setItems(newItems);
          setInflationRate(newInflation);
          setActiveScenarioId(null);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      } catch (err) {
        console.error('Import failed:', err);
        alert('Failed to parse CSV. Ensure it was exported from this app.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const loadScenario = (s: Scenario) => {
    setProfile(s.profile);
    setItems(s.items);
    setInflationRate(s.inflationRate);
    setActiveScenarioId(s.id);
  };

  const deleteScenario = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScenarios(scenarios.filter(s => s.id !== id));
    if (activeScenarioId === id) setActiveScenarioId(null);
  };

  const duplicateScenario = (s: Scenario, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated: Scenario = {
      ...s,
      id: generateId(),
      name: `${s.name} (Copy)`,
      updatedAt: Date.now()
    };
    setScenarios([...scenarios, duplicated]);
  };

  const simulationData = useMemo(() => {
    return runSimulation(profile, items, inflationRate);
  }, [profile, items, inflationRate]);

  const stats = useMemo(() => {
    const finalYear = simulationData[simulationData.length - 1];
    const peakNw = Math.max(...simulationData.map(d => d.netWorth));
    const bankruptcyYear = simulationData.find(d => d.isBankrupt);
    
    // Calculate average annual cash flow during working years
    const workingYears = simulationData.filter(d => d.age < profile.retirementAge);
    const avgNetFlow = workingYears.length > 0 
      ? workingYears.reduce((sum, d) => sum + (d.income - d.expenses), 0) / workingYears.length 
      : 0;

    return {
      finalNetWorth: finalYear?.netWorth || 0,
      peakNetWorth: peakNw,
      bankruptcyAge: bankruptcyYear?.age || null,
      avgNetFlow,
    };
  }, [simulationData, profile.retirementAge]);

  const getAssetLabel = (type: AssetType) => {
    switch(type) {
      case AssetType.CASH: return 'Cash';
      case AssetType.BROKERAGE: return 'Brokerage';
      case AssetType.TRADITIONAL_401K: return '401k';
      case AssetType.ROTH_401K: return 'Roth';
      case AssetType.REAL_ESTATE: return 'Property';
      default: return type;
    }
  };

  const milestones = useMemo(() => {
    const found: Record<string, number> = {};
    // Track first time an asset type is tapped
    simulationData.forEach(d => {
      if (d.tappedAssetTypes) {
        d.tappedAssetTypes.forEach(type => {
          if (found[type] === undefined) {
            found[type] = d.age;
          }
        });
      }
    });

    // Group by age
    const byAge: Record<number, AssetType[]> = {};
    Object.entries(found).forEach(([type, age]) => {
      if (!byAge[age]) byAge[age] = [];
      byAge[age].push(type as AssetType);
    });

    return Object.entries(byAge)
      .map(([age, types]) => ({ 
        age: parseInt(age), 
        label: types.map(t => getAssetLabel(t)).join(' & ') + ' Tapped'
      }))
      .sort((a, b) => a.age - b.age);
  }, [simulationData]);

  const addItem = (type: FinancialItemType) => {
    const isFlow = type === FinancialItemType.INCOME || type === FinancialItemType.EXPENSE;
    const isOneTime = type === FinancialItemType.ONE_TIME_EXPENSE;
    
    const newItem: FinancialItem = {
      id: generateId(),
      title: 'New ' + (type === FinancialItemType.ASSET ? 'Asset' : (type === FinancialItemType.ONE_TIME_EXPENSE ? 'Expense' : type)),
      type,
      assetType: type === FinancialItemType.ASSET ? AssetType.BROKERAGE : undefined,
      value: type === FinancialItemType.ASSET ? 10000 : (isFlow || isOneTime ? 2000 : 5000),
      frequency: isFlow ? Frequency.MONTHLY : undefined,
      growthRate: type === FinancialItemType.ASSET ? 0.07 : (type === FinancialItemType.EXPENSE ? 0.03 : 0),
      startAge: type === FinancialItemType.ONE_TIME_EXPENSE ? profile.currentAge + 5 : profile.currentAge,
      endAge: type === FinancialItemType.ONE_TIME_EXPENSE ? profile.currentAge + 5 : ((type === FinancialItemType.ASSET || type === FinancialItemType.EXPENSE) ? profile.lifeExpectancy : profile.retirementAge),
      isLiquid: type === FinancialItemType.ASSET,
      isTodayDollars: isOneTime ? true : undefined,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<FinancialItem>) => {
    setItems(items.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatLargeCurrency = (val: number) => {
    if (Math.abs(val) >= 1000000) {
      return `$${(val / 1000000).toFixed(2)}M`;
    }
    return formatCurrency(val);
  };

  const [hoveredSnapshot, setHoveredSnapshot] = useState<SimulationResult | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-emerald-500 selection:text-white transition-colors duration-300",
      isDarkMode ? "bg-[#0A0A0A] text-gray-400 dark" : "bg-[#FDFDFD] text-gray-700"
    )}>
      <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
        {/* Left Sidebar: Controls & Inputs */}
        <aside className={cn(
          "w-full lg:w-96 border-b lg:border-b-0 lg:border-r flex flex-col h-screen overflow-y-auto shrink-0 shadow-xl z-30 transition-colors",
          isDarkMode ? "bg-[#111] border-gray-800 shadow-black/40" : "bg-white border-gray-200"
        )}>
          <div className={cn(
            "p-8 border-b shrink-0 flex items-center justify-between",
            isDarkMode ? "border-gray-800" : "border-gray-100"
          )}>
            <div>
              <h1 className={cn(
                "text-xl font-semibold tracking-tight flex items-center gap-2",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.3)]"></div>
                WealthFlow
              </h1>
              <p className={cn(
                "text-[10px] uppercase tracking-widest font-bold mt-2",
                isDarkMode ? "text-gray-500" : "text-gray-500"
              )}>Personal Wealth Model</p>
            </div>
            
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "p-2.5 rounded-xl transition-all cursor-pointer",
                isDarkMode 
                  ? "bg-gray-800 text-yellow-400 hover:bg-gray-700 shadow-inner" 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"
              )}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
            {/* Profile Section */}
            <SidebarSection 
              id="parameters" 
              title="Core Parameters" 
              icon={Info}
              isOpen={openSections.parameters}
              onToggle={toggleSection}
              isDarkMode={isDarkMode}
            >
              <div className="space-y-4">
                <div className={cn(
                  "flex items-center gap-3 p-3 border rounded-xl transition-colors",
                  isDarkMode ? "bg-blue-900/20 border-blue-800/30 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-700"
                )}>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <p className="text-[10px] font-medium leading-tight">
                    {profile.residenceState} Tax Model Applied
                  </p>
                </div>

                <div>
                  <TooltipLabel isDarkMode={isDarkMode} tooltip="The US state for income tax calculations. Some states have no income tax (TX, FL, WA, etc.)">
                    Residence State
                  </TooltipLabel>
                  <select 
                    value={profile.residenceState}
                    onChange={e => setProfile({...profile, residenceState: e.target.value})}
                    className={cn(
                      "w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono shadow-sm appearance-none",
                      isDarkMode ? "bg-black/40 border-white/5 text-white focus:bg-black/60" : "bg-gray-50 border-gray-100 text-gray-900 focus:bg-white focus:border-emerald-500 hover:border-gray-200"
                    )}
                  >
                    <option value="CA">California</option>
                    <option value="NY">New York</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                    <option value="WA">Washington</option>
                    <option value="NV">Nevada</option>
                    <option value="IL">Illinois</option>
                    <option value="MA">Massachusetts</option>
                    <option value="OTHER">Other / Average (5%)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <TooltipLabel isDarkMode={isDarkMode} tooltip="Your current age. This is the starting point of the simulation.">
                      Age
                    </TooltipLabel>
                    <input 
                      type="number" 
                      value={profile.currentAge}
                      onChange={e => setProfile({...profile, currentAge: parseInt(e.target.value)})}
                      className={cn(
                        "w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono shadow-sm",
                        isDarkMode ? "bg-black/40 border-white/5 text-white focus:bg-black/60" : "bg-gray-50 border-gray-100 text-gray-900 focus:bg-white focus:border-emerald-500 hover:border-gray-200"
                      )}
                    />
                  </div>
                  <div>
                    <TooltipLabel isDarkMode={isDarkMode} tooltip="The age you plan to stop working. Active income sources will typically end here unless specified otherwise.">
                      Retire
                    </TooltipLabel>
                    <input 
                      type="number" 
                      value={profile.retirementAge}
                      onChange={e => setProfile({...profile, retirementAge: parseInt(e.target.value)})}
                      className={cn(
                        "w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono shadow-sm",
                        isDarkMode ? "bg-black/40 border-white/5 text-white focus:bg-black/60" : "bg-gray-50 border-gray-100 text-gray-900 focus:bg-white focus:border-emerald-500 hover:border-gray-200"
                      )}
                    />
                  </div>
                </div>
                <div>
                  <TooltipLabel isDarkMode={isDarkMode} tooltip="The age the simulation ends. Usually set to a very conservative length (e.g. 95 or 100).">
                    Life Expectancy
                  </TooltipLabel>
                  <input 
                    type="number" 
                    value={profile.lifeExpectancy}
                    onChange={e => setProfile({...profile, lifeExpectancy: parseInt(e.target.value)})}
                    className={cn(
                      "w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono shadow-sm",
                      isDarkMode ? "bg-black/40 border-white/5 text-white focus:bg-black/60" : "bg-gray-50 border-gray-100 text-gray-900 focus:bg-white focus:border-emerald-500 hover:border-gray-200"
                    )}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <TooltipLabel isDarkMode={isDarkMode} tooltip="The annual rate at which the cost of living increases. This affects expenses and some income growth.">
                      Inflation
                    </TooltipLabel>
                    <span className={cn("text-xs font-mono font-bold", isDarkMode ? "text-white" : "text-gray-900")}>{(inflationRate * 100).toFixed(1)}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="15"
                    step="0.1"
                    value={inflationRate * 100}
                    onChange={e => setInflationRate(parseFloat(e.target.value) / 100)}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </SidebarSection>

            {/* Financial Sections */}
            {[
              { id: 'assets', title: 'Assets', type: FinancialItemType.ASSET, icon: Wallet },
              { id: 'debts', title: 'Debts', type: FinancialItemType.LIABILITY, icon: TrendingDown },
              { id: 'income', title: 'Income', type: FinancialItemType.INCOME, icon: TrendingUp },
              { id: 'expenses', title: 'Recurring Expenses', type: FinancialItemType.EXPENSE, icon: PieChart },
              { id: 'one_time_expenses', title: 'One-time Expenses', type: FinancialItemType.ONE_TIME_EXPENSE, icon: Calendar },
            ].map(section => (
              <SidebarSection
                key={section.id}
                id={section.id}
                title={section.title}
                icon={section.icon}
                isOpen={openSections[section.id]}
                onToggle={toggleSection}
                count={items.filter(i => i.type === section.type).length}
                onAdd={() => addItem(section.type as FinancialItemType)}
                isDarkMode={isDarkMode}
              >
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {items.filter(i => i.type === section.type).map((item) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={item.id}
                        className={cn(
                          "border rounded-2xl p-5 hover:bg-opacity-80 transition-all group relative shadow-sm",
                          isDarkMode ? "bg-black/30 border-white/5 shadow-black/20" : "bg-gray-50 border-gray-100"
                        )}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 flex-1">
                            <div className={cn(
                              "w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]",
                              item.type === FinancialItemType.INCOME ? "text-emerald-600 bg-emerald-600" : 
                              (item.type === FinancialItemType.EXPENSE || item.type === FinancialItemType.ONE_TIME_EXPENSE) ? "text-red-600 bg-red-600" : 
                              item.type === FinancialItemType.ASSET ? "text-blue-600 bg-blue-600" : "text-amber-600 bg-amber-600"
                            )} />
                            <input 
                              className={cn(
                                "bg-transparent border-none p-0 font-medium text-sm focus:ring-0 outline-none w-full transition-colors",
                                isDarkMode ? "text-white" : "text-gray-900"
                              )}
                              value={item.title}
                              onChange={e => updateItem(item.id, { title: e.target.value })}
                            />
                          </div>
                          <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            {item.type === FinancialItemType.ASSET ? (
                              <div className="mb-3">
                                <TooltipLabel isDarkMode={isDarkMode} tooltip="Categorize your asset to apply appropriate growth and tax treatment (e.g. 401k withdrawals are taxed differently than Brokerage sales).">
                                  Asset Class
                                </TooltipLabel>
                                <select 
                                  value={item.assetType}
                                  onChange={e => updateItem(item.id, { assetType: e.target.value as AssetType })}
                                  className={cn(
                                    "w-full border rounded-lg px-2 py-1.5 text-xs outline-none font-mono appearance-none cursor-pointer shadow-sm transition-all",
                                    isDarkMode ? "bg-gray-800 border-gray-700 text-white hover:bg-gray-700" : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50"
                                  )}
                                >
                                  <option value={AssetType.CASH}>Cash / HYSA</option>
                                  <option value={AssetType.BROKERAGE}>Brokerage (Taxable)</option>
                                  <option value={AssetType.TRADITIONAL_401K}>Traditional 401k/IRA</option>
                                  <option value={AssetType.ROTH_401K}>Roth 401k/IRA</option>
                                  <option value={AssetType.REAL_ESTATE}>Real Estate</option>
                                </select>
                              </div>
                            ) : null}
                            <TooltipLabel isDarkMode={isDarkMode} tooltip={item.type === FinancialItemType.ASSET || item.type === FinancialItemType.LIABILITY ? 'The current balance of this account.' : 'The cash value associated with this transaction.'}>
                               {item.type === FinancialItemType.ASSET || item.type === FinancialItemType.LIABILITY 
                                 ? 'Balance' 
                                 : item.type === FinancialItemType.ONE_TIME_EXPENSE ? 'Expense Amount' : (item.frequency === Frequency.MONTHLY ? 'Monthly Value' : (item.type === FinancialItemType.INCOME ? 'Gross Annual Salary' : 'Annual Value'))}
                            </TooltipLabel>
                            {item.type === FinancialItemType.INCOME && (
                              <p className="text-[8px] text-gray-500 mb-1 leading-tight italic">
                                Pre-tax amount estimation.
                              </p>
                            )}
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] opacity-40 text-gray-400">$</span>
                              <input 
                                type="number"
                                value={item.value}
                                onChange={e => updateItem(item.id, { value: parseFloat(e.target.value) || 0 })}
                                className={cn(
                                  "w-full border rounded-lg pl-5 pr-2 py-1.5 text-xs outline-none font-mono shadow-sm transition-colors",
                                  isDarkMode ? "bg-gray-800 border-gray-700 text-white focus:border-emerald-500" : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500"
                                )}
                              />
                            </div>
                          </div>
                          <div>
                            {item.type === FinancialItemType.ONE_TIME_EXPENSE ? (
                              <TooltipLabel isDarkMode={isDarkMode} tooltip="If 'Yes', the amount is entered in today's dollars and will be inflated to its future value at the time of the expense. If 'No', the amount is considered the exact target value.">
                                Adjust for Inflation?
                              </TooltipLabel>
                            ) : (
                              <TooltipLabel isDarkMode={isDarkMode} tooltip="The expected annual rate of return for this account or interest rate for this debt.">
                                {item.frequency ? 'Period' : (
                                  item.type === FinancialItemType.ASSET ? 'Growth (Annual)' : 'APY (Annual)'
                                )}
                              </TooltipLabel>
                            )}
                            {item.frequency ? (
                              <div className={cn(
                                "flex border rounded-lg p-0.5 h-[34px] shadow-sm transition-colors",
                                isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                              )}>
                                <button 
                                  onClick={() => updateItem(item.id, { frequency: Frequency.MONTHLY })}
                                  className={cn(
                                    "flex-1 text-[8px] uppercase font-bold rounded-md transition-all cursor-pointer",
                                    item.frequency === Frequency.MONTHLY 
                                      ? (isDarkMode ? "bg-white/10 text-white shadow-inner" : "bg-gray-100 text-gray-900 shadow-inner") 
                                      : "text-gray-400 hover:text-gray-600"
                                  )}
                                >
                                  Mon
                                </button>
                                <button 
                                  onClick={() => updateItem(item.id, { frequency: Frequency.ANNUAL })}
                                  className={cn(
                                    "flex-1 text-[8px] uppercase font-bold rounded-md transition-all cursor-pointer",
                                    item.frequency === Frequency.ANNUAL 
                                      ? (isDarkMode ? "bg-white/10 text-white shadow-inner" : "bg-gray-100 text-gray-900 shadow-inner") 
                                      : "text-gray-400 hover:text-gray-600"
                                  )}
                                >
                                  Ann
                                </button>
                              </div>
                            ) : item.type === FinancialItemType.ONE_TIME_EXPENSE ? (
                              <div className={cn(
                                "flex border rounded-lg p-0.5 h-[34px] shadow-sm transition-colors",
                                isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                              )}>
                                <button 
                                  onClick={() => updateItem(item.id, { isTodayDollars: true })}
                                  className={cn(
                                    "flex-1 text-[8px] uppercase font-bold rounded-md transition-all cursor-pointer",
                                    item.isTodayDollars 
                                      ? (isDarkMode ? "bg-white/10 text-white shadow-inner" : "bg-gray-100 text-gray-900 shadow-inner") 
                                      : "text-gray-400 hover:text-gray-600"
                                  )}
                                  title="Factor in future inflation."
                                >
                                  Yes
                                </button>
                                <button 
                                  onClick={() => updateItem(item.id, { isTodayDollars: false })}
                                  className={cn(
                                    "flex-1 text-[8px] uppercase font-bold rounded-md transition-all cursor-pointer",
                                    !item.isTodayDollars 
                                      ? (isDarkMode ? "bg-white/10 text-white shadow-inner" : "bg-gray-100 text-gray-900 shadow-inner") 
                                      : "text-gray-400 hover:text-gray-600"
                                  )}
                                  title="Amount is already inflated."
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className="relative">
                                <input 
                                  type="number"
                                  step="0.1"
                                  value={+(item.growthRate * 100).toFixed(1)}
                                  onChange={e => updateItem(item.id, { growthRate: (parseFloat(e.target.value) / 100) || 0 })}
                                  className={cn(
                                    "w-full border rounded-lg px-2 py-1.5 text-xs outline-none font-mono shadow-sm transition-colors",
                                    isDarkMode ? "bg-gray-800 border-gray-700 text-white focus:border-emerald-500" : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500"
                                  )}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] opacity-40 text-gray-400">%</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {item.frequency && (
                          <div className="mt-3">
                            <TooltipLabel isDarkMode={isDarkMode} tooltip="The annual growth rate of this income or expense. Expenses usually grow with inflation.">
                              Growth ({item.frequency === Frequency.MONTHLY ? 'Monthly Compounded' : 'Annual'})
                            </TooltipLabel>
                            <div className="relative">
                              <input 
                                type="number"
                                step="0.1"
                                value={+(item.growthRate * 100).toFixed(1)}
                                onChange={e => updateItem(item.id, { growthRate: (parseFloat(e.target.value) / 100) || 0 })}
                                className={cn(
                                  "w-full border rounded-lg px-2 py-1.5 text-xs outline-none font-mono shadow-sm transition-colors",
                                  isDarkMode ? "bg-gray-800 border-gray-700 text-white focus:border-emerald-500" : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500"
                                )}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] opacity-40 text-gray-400">%</span>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            <TooltipLabel isDarkMode={isDarkMode} tooltip={item.type === FinancialItemType.ONE_TIME_EXPENSE ? "The age when this expense occurs." : "The age when this financial item starts affecting your model."}>
                              {item.type === FinancialItemType.ONE_TIME_EXPENSE ? "Occurrence Age" : "Start Age"}
                            </TooltipLabel>
                            <input 
                              type="number"
                              value={item.startAge}
                              onChange={e => {
                                const age = parseInt(e.target.value) || 0;
                                if (item.type === FinancialItemType.ONE_TIME_EXPENSE) {
                                  updateItem(item.id, { startAge: age, endAge: age });
                                } else {
                                  updateItem(item.id, { startAge: age });
                                }
                              }}
                              className={cn(
                                "w-full border rounded-lg px-2 py-1 text-xs outline-none font-mono shadow-sm transition-colors",
                                isDarkMode ? "bg-gray-800 border-gray-700 text-white focus:border-emerald-500" : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500"
                              )}
                            />
                          </div>
                          {item.type !== FinancialItemType.ONE_TIME_EXPENSE && (
                            <div>
                              <TooltipLabel isDarkMode={isDarkMode} tooltip="The age when this financial item ends (e.g. retirement age for salary, life expectancy for expenses).">End Age</TooltipLabel>
                              <input 
                                type="number"
                                value={item.endAge}
                                onChange={e => updateItem(item.id, { endAge: parseInt(e.target.value) || 0 })}
                                className={cn(
                                  "w-full border rounded-lg px-2 py-1 text-xs outline-none font-mono shadow-sm transition-colors",
                                  isDarkMode ? "bg-gray-800 border-gray-700 text-white focus:border-emerald-500" : "bg-white border-gray-200 text-gray-900 focus:border-emerald-500"
                                )}
                              />
                            </div>
                          )}
                        </div>

                        {item.type === FinancialItemType.INCOME && (
                          <div className="mt-3">
                            <TooltipLabel isDarkMode={isDarkMode} tooltip="Where unspent money from this income source is automatically deposited.">
                               Investment Strategy
                            </TooltipLabel>
                            <select 
                              value={item.surplusAssetId || ''}
                              onChange={(e) => updateItem(item.id, { surplusAssetId: e.target.value })}
                              className={cn(
                                "w-full border rounded-lg px-2 py-1.5 text-xs outline-none font-mono appearance-none cursor-pointer shadow-sm transition-all",
                                isDarkMode ? "bg-gray-800 border-gray-700 text-white hover:bg-gray-700" : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50"
                              )}
                            >
                              <option value="">Default (Highest Yield)</option>
                              {items.filter(i => i.type === FinancialItemType.ASSET && i.isLiquid).map(i => (
                                <option key={i.id} value={i.id}>{i.title}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {item.type === FinancialItemType.ASSET && (
                          <div className="mt-3">
                            <label 
                              className="flex items-center gap-2 cursor-help group/check relative"
                            >
                              <input 
                                type="checkbox" 
                                checked={item.isLiquid} 
                                onChange={e => updateItem(item.id, { isLiquid: e.target.checked })}
                                className={cn(
                                  "rounded focus:ring-emerald-500/20 transition-all",
                                  isDarkMode ? "bg-gray-800 border-gray-700 text-emerald-500" : "border-gray-300 bg-white text-emerald-600"
                                )}
                              />
                              <span className={cn(
                                "text-[9px] font-bold uppercase transition-colors flex items-center gap-1 group/liquid",
                                isDarkMode ? "text-gray-500 group-hover/check:text-gray-300" : "text-gray-500 group-hover/check:text-gray-700"
                              )}>
                                Liquid Account
                                <div className="relative group/tool">
                                  <Info className="w-2.5 h-2.5 opacity-40 group-hover/liquid:opacity-100 transition-opacity" />
                                  <div className="absolute left-full ml-2 top-0 w-48 p-2 bg-gray-900 text-white text-[9px] rounded-lg opacity-0 pointer-events-none group-hover/liquid:opacity-100 transition-all z-50 normal-case font-normal shadow-xl border border-white/10 scale-95 group-hover/liquid:scale-100">
                                    Whether this account can be easily accessed to pay for expenses. Non-liquid assets (like Real Estate) will only be sold as a last resort.
                                  </div>
                                </div>
                              </span>
                            </label>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </SidebarSection>
            ))}
          </div>
        </aside>

        {/* Main Content: Visualization */}
        <main className={cn(
          "flex-1 flex flex-col h-screen overflow-y-auto transition-colors duration-300",
          isDarkMode ? "bg-[#0A0A0A] text-gray-400" : "bg-white text-gray-700"
        )}>
          {/* Top Metrics Area */}
          <header className={cn(
            "h-32 border-b flex items-center px-10 gap-16 shrink-0 backdrop-blur-xl sticky top-0 z-20 transition-colors",
            isDarkMode ? "bg-black/40 border-gray-800" : "bg-white/80 border-gray-200"
          )}>
            <div className="flex flex-col items-start">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5 flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-emerald-600" /> Projected Peak Net Worth
              </div>
              <div className={cn(
                "text-4xl font-light tracking-tight transition-colors",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                {formatLargeCurrency(stats.peakNetWorth)}
              </div>
            </div>

            <div className={cn("h-12 w-[1px]", isDarkMode ? "bg-gray-800" : "bg-gray-200")} />

            <div className="flex flex-col items-start">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5 flex items-center gap-2">
                <PieChart className="w-3 h-3 text-blue-600" /> Net Worth at End of Life
              </div>
              <div className={cn(
                "text-4xl font-light tracking-tight transition-colors",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                {formatLargeCurrency(stats.finalNetWorth)}
              </div>
            </div>

            <div className={cn("h-12 w-[1px]", isDarkMode ? "bg-gray-800" : "bg-gray-200")} />

            <div className="flex flex-col items-start">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5 flex items-center gap-2">
                <AlertCircle className={cn("w-3 h-3", stats.bankruptcyAge ? "text-red-600" : "text-emerald-600")} /> 
                Asset Depletion Age
              </div>
              <div className={cn(
                "text-4xl font-light tracking-tight transition-colors",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                {stats.bankruptcyAge || profile.lifeExpectancy}
              </div>
            </div>

            <div className="ml-auto flex gap-3">
                <label className={cn(
                  "h-10 px-4 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap",
                  isDarkMode ? "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                )}>
                  <FileUp className="w-3.5 h-3.5" />
                  Import
                  <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
                </label>
                <button 
                  onClick={handleExportCSV}
                  className={cn(
                    "h-10 px-4 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap",
                    isDarkMode ? "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
            </div>
          </header>


          <div className="flex-1 p-10 space-y-20 pb-32">
            {/* Main Graph */}
            <section className="space-y-10">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className={cn(
                    "text-2xl font-medium tracking-tight transition-colors",
                    isDarkMode ? "text-white" : "text-gray-900"
                  )}>Net Worth Projection</h3>
                  <p className="text-xs text-gray-400 mt-2 max-w-lg leading-relaxed">Multi-dimensional burndown analysis modeling asset growth, cash flow dynamics, and inflationary pressures over time.</p>
                </div>
                <div className="flex gap-8">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981]" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Accumulation</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_12px_#f59e0b]" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Distribution</span>
                  </div>
                </div>
              </div>

              <div className={cn(
                "h-[520px] w-full border rounded-[48px] p-12 relative group shadow-2xl overflow-hidden transition-colors",
                isDarkMode ? "bg-black border-gray-800" : "bg-white border-gray-100"
              )}>
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={simulationData} margin={{ top: 80, right: 30, left: 10, bottom: 30 }}>
                      <defs>
                        <linearGradient id="colorNw" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#ffffff" : "#000000"} strokeOpacity={isDarkMode ? 0.1 : 0.06} />
                      <XAxis 
                        dataKey="age" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontWeight: '500', fontFamily: 'JetBrains Mono' }}
                        dy={25}
                        interval={9}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: isDarkMode ? '#9CA3AF' : '#6B7280', fontWeight: '500', fontFamily: 'JetBrains Mono' }}
                        tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return <SnapshotTooltipContent data={payload[0].payload} formatCurrency={formatCurrency} isDarkMode={isDarkMode} />;
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="netWorth" 
                        stroke="#10b981" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorNw)" 
                        animationDuration={1500}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />

                      {milestones.map((m, idx) => (
                        <ReferenceLine 
                          key={m.age}
                          x={m.age} 
                          stroke={isDarkMode ? "#333" : "#E5E7EB"} 
                          strokeDasharray="4 4"
                        >
                          <Label 
                            value={m.label} 
                            position={idx % 2 === 0 ? "top" : "bottom"}
                            fill={isDarkMode ? "#9CA3AF" : "#6B7280"}
                            fontSize={9}
                            fontWeight="800"
                            className="uppercase tracking-widest"
                            offset={idx % 2 === 0 ? 40 : -40}
                          />
                        </ReferenceLine>
                      ))}
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
            </section>

            {/* Bottom Section: Dataset Table */}
            <section className={cn(
              "border rounded-[48px] overflow-hidden flex flex-col pt-12 shadow-lg transition-colors",
              isDarkMode ? "bg-black border-gray-800" : "bg-white border-gray-100"
            )}>
               <div className="px-12 mb-10">
                 <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-gray-400">Asset Table</h4>
                 <p className="text-xs text-gray-400 mt-2">Your assets over time</p>
               </div>
               <div className="overflow-auto flex-1 px-6 pb-6 scrollbar-hide">
                 <table className="w-full text-left text-[11px] border-separate border-spacing-y-2">
                    <thead className={cn(
                      "sticky top-0 z-10 transition-colors",
                      isDarkMode ? "bg-black" : "bg-white"
                    )}>
                       <tr className="uppercase tracking-[0.2em] text-gray-400">
                          <th className="px-6 py-2 rounded-l-2xl text-xs font-black">Period</th>
                          <th className="px-6 py-2 text-xs font-black">Equity</th>
                          <th className="px-6 py-2 text-xs font-normal">Cash</th>
                          <th className="px-6 py-2 rounded-r-2xl text-right text-xs font-normal">In/Out</th>
                       </tr>
                    </thead>
                    <tbody className="font-mono">
                       {simulationData.filter((_, i) => i % 5 === 0).map((d) => (
                          <tr 
                            key={d.age} 
                            onMouseEnter={(e) => {
                              setHoveredSnapshot(d);
                              setTooltipPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseMove={(e) => {
                              setTooltipPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseLeave={() => setHoveredSnapshot(null)}
                            className={cn(
                              "transition-all group rounded-2xl cursor-help",
                              isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50"
                            )}
                          >
                             <td className={cn(
                               "px-6 py-2 transition-colors rounded-l-2xl w-[399px]",
                               isDarkMode ? "text-gray-400 group-hover:text-white" : "text-gray-500 group-hover:text-gray-900"
                             )}>Age {d.age}</td>
                             <td className={cn(
                               "px-6 py-2 font-bold",
                               isDarkMode ? "text-gray-200" : "text-gray-900"
                             )}>{formatLargeCurrency(d.netWorth)}</td>
                             <td className={cn(
                               "px-6 py-2 font-medium",
                               isDarkMode ? "text-blue-400 font-bold" : "text-blue-600"
                             )}>{formatLargeCurrency(d.liquidAssets)}</td>
                             <td className="px-6 py-2 rounded-r-2xl text-right">
                               <div className="flex flex-col items-end gap-1">
                                 <span className="text-emerald-600/80 font-black">+{formatLargeCurrency(d.income)}</span>
                                 <span className="text-red-500/80 font-black">-{formatLargeCurrency(d.expenses)}</span>
                               </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
               </div>
            </section>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {hoveredSnapshot && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            style={{ 
              position: 'fixed', 
              top: tooltipPos.y - 10, 
              left: tooltipPos.x + 20, 
              zIndex: 1000,
              pointerEvents: 'none',
              transform: 'translateY(-100%)'
            }}
          >
            <SnapshotTooltipContent data={hoveredSnapshot} formatCurrency={formatCurrency} isDarkMode={isDarkMode} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SidebarSection = ({ 
  id, 
  title, 
  icon: Icon, 
  onAdd, 
  isOpen,
  onToggle,
  count,
  isDarkMode,
  children 
}: { 
  id: string; 
  title: string; 
  icon: any; 
  onAdd?: () => void; 
  isOpen: boolean;
  onToggle: (id: string) => void;
  count?: number;
  isDarkMode: boolean;
  children: React.ReactNode;
  key?: React.Key;
}) => {
  return (
    <section className={cn(
      "border-b last:border-0 transition-colors",
      isDarkMode ? "border-gray-800" : "border-gray-50"
    )}>
      <div 
        className={cn(
          "flex items-center justify-between py-4 px-8 cursor-pointer transition-colors group",
          isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50"
        )}
        onClick={() => onToggle(id)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "transition-transform duration-200",
            isOpen ? "rotate-180" : "rotate-0"
          )}>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <Icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500 transition-colors" />
          <div className="flex items-center gap-2">
            <h2 className={cn(
              "text-[10px] uppercase tracking-widest font-black transition-colors",
              isDarkMode ? "text-gray-500 group-hover:text-gray-400" : "text-gray-500"
            )}>{title}</h2>
            {count !== undefined && count > 0 && (
              <span className={cn(
                "flex items-center justify-center px-1.5 py-0.5 rounded-full text-[8px] font-bold min-w-[18px] transition-colors",
                isDarkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500"
              )}>
                {count}
              </span>
            )}
          </div>
        </div>
        {onAdd && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className={cn(
              "w-5 h-5 flex items-center justify-center rounded-full transition-all active:scale-95 shadow-sm",
              isDarkMode ? "bg-emerald-900/30 text-emerald-500 hover:bg-emerald-500 hover:text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white"
            )}
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={cn(
              "overflow-hidden transition-colors",
              isDarkMode ? "bg-[#111]" : "bg-white"
            )}
          >
            <div className="px-8 pb-6 pt-1 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const SnapshotTooltipContent = ({ data, formatCurrency, isDarkMode }: { data: SimulationResult, formatCurrency: (val: number) => string, isDarkMode: boolean }) => {
  const totalGross = data.income + data.taxPaid;
  const getRate = (tax: number) => totalGross > 0 ? ((tax / totalGross) * 100).toFixed(1) : '0.0';

  return (
    <div className={cn(
      "p-6 rounded-[28px] shadow-3xl border backdrop-blur-3xl min-w-[280px] transition-colors",
      isDarkMode ? "bg-black/90 border-gray-800 text-white" : "bg-white/95 text-gray-900 border-gray-100"
    )}>
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-4 flex items-center justify-between">
        <span>Snapshot</span>
        <span className={cn(isDarkMode ? "text-white" : "text-gray-900")}>Age {data.age}</span>
      </p>
      <div className="space-y-4">
        <div className="flex justify-between gap-16 items-center">
          <span className="text-[11px] text-gray-500 font-medium tracking-tight">Total Net Worth</span>
          <span className={cn("text-sm font-mono font-bold tracking-tighter", isDarkMode ? "text-white" : "text-gray-900")}>{formatCurrency(data.netWorth)}</span>
        </div>
        <div className="flex justify-between gap-16 items-center">
          <span className="text-[11px] text-gray-500 font-medium tracking-tight">Liquid Assets</span>
          <span className="text-sm font-mono font-bold text-blue-500 tracking-tighter">{formatCurrency(data.liquidAssets)}</span>
        </div>
        
        <div className={cn("h-px my-1", isDarkMode ? "bg-gray-800 border-gray-800" : "bg-gray-100")} />
        
        <div className="flex justify-between gap-16 items-center">
          <span className="text-[11px] text-gray-500 font-medium tracking-tight">Total Taxes Paid</span>
          <span className="text-[11px] font-mono font-bold text-red-500 tracking-tighter">
            -{formatCurrency(data.taxPaid)} ({getRate(data.taxPaid)}%)
          </span>
        </div>

        <div className={cn(
          "space-y-2 pl-2 border-l-2",
          isDarkMode ? "border-gray-800" : "border-gray-50"
        )}>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-400">Federal Income</span>
            <span className={cn("font-mono", isDarkMode ? "text-gray-300" : "text-gray-600")}>
              {formatCurrency(data.taxBreakdown.federal)} <span className="opacity-60">({getRate(data.taxBreakdown.federal)}%)</span>
            </span>
          </div>
                          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-400">{data.residenceState || 'State'} Tax</span>
            <span className={cn("font-mono", isDarkMode ? "text-gray-300" : "text-gray-600")}>
              {formatCurrency(data.taxBreakdown.state)} <span className="opacity-60">({getRate(data.taxBreakdown.state)}%)</span>
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-400">FICA (SS+Med)</span>
            <span className={cn("font-mono", isDarkMode ? "text-gray-300" : "text-gray-600")}>
              {formatCurrency(data.taxBreakdown.fica)} <span className="opacity-60">({getRate(data.taxBreakdown.fica)}%)</span>
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-gray-400">Capital Gains (Est.)</span>
            <span className={cn("font-mono", isDarkMode ? "text-gray-300" : "text-gray-600")}>
              {formatCurrency(data.taxBreakdown.capitalGains)} <span className="opacity-60">({getRate(data.taxBreakdown.capitalGains)}%)</span>
            </span>
          </div>
        </div>

        <div className={cn("h-px my-1", isDarkMode ? "bg-gray-800" : "bg-gray-100")} />
        
        <div className="flex justify-between gap-16 items-center">
          <span className="text-[11px] text-gray-500 font-medium tracking-tight">Effective Rate</span>
          <span className="text-[11px] font-mono font-bold text-gray-500 tracking-tighter">
            {getRate(data.taxPaid)}%
          </span>
        </div>
        
        <div className="flex justify-between gap-16 items-center">
          <span className="text-[11px] text-gray-500 font-medium tracking-tight">Net Flux</span>
          <span className={cn(
            "text-[11px] font-mono font-bold tracking-tighter",
            data.income >= data.expenses ? "text-emerald-500" : "text-red-500"
          )}>
            {data.income >= data.expenses ? '+' : '-'}{formatCurrency(Math.abs(data.income - data.expenses))}
          </span>
        </div>
      </div>
    </div>
  );
};
