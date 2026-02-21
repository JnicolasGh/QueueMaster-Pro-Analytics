/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Monitor, 
  UserRound, 
  Settings, 
  Ticket as TicketIcon,
  Bell,
  CheckCircle2,
  Clock,
  Users,
  ArrowRight,
  Plus,
  Trash2,
  Volume2,
  Lock,
  LogOut,
  ShieldCheck,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { format, differenceInMinutes, startOfDay, subDays, isWithinInterval } from 'date-fns';
import { Category, Counter, Ticket, AppState, TicketStatus, User, UserRole } from './types';
import { generateSyntheticData } from './utils/dataGenerator';

// --- Constants & Defaults ---
const DEFAULT_CATEGORIES: Category[] = [
  { 
    id: '1', name: 'Servicio al Cliente', prefix: 'S', color: '#3b82f6',
    subCategories: [
      { id: '1-1', name: 'sub_servicio_1' },
      { id: '1-2', name: 'sub_servicio_2' },
      { id: '1-3', name: 'sub_servicio_3' }
    ]
  },
  { 
    id: '2', name: 'Preferencial', prefix: 'P', color: '#ef4444',
    subCategories: [
      { id: '2-1', name: 'sub_preferencial_1' },
      { id: '2-2', name: 'sub_preferencial_2' },
      { id: '2-3', name: 'sub_preferencial_3' }
    ]
  },
  { 
    id: '3', name: 'Caja y Pagos', prefix: 'C', color: '#10b981',
    subCategories: [
      { id: '3-1', name: 'sub_caja_1' },
      { id: '3-2', name: 'sub_caja_2' },
      { id: '3-3', name: 'sub_caja_3' }
    ]
  },
  { 
    id: '4', name: 'Asesoría Comercial', prefix: 'A', color: '#8b5cf6',
    subCategories: [
      { id: '4-1', name: 'sub_comercial_1' },
      { id: '4-2', name: 'sub_comercial_2' },
      { id: '4-3', name: 'sub_comercial_3' }
    ]
  },
];

const DEFAULT_COUNTERS: Counter[] = [
  { id: 1, name: 'Ventanilla 1', status: 'idle' },
  { id: 2, name: 'Ventanilla 2', status: 'idle' },
  { id: 3, name: 'Ventanilla 3', status: 'idle' },
];

const STORAGE_KEY = 'queuemaster_state';
const AUTH_KEY = 'queuemaster_user';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState<'kiosk' | 'advisor' | 'tv' | 'admin' | 'analytics'>('kiosk');
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Ensure all categories have subCategories array
      parsed.categories = parsed.categories.map((c: any) => ({
        ...c,
        subCategories: c.subCategories || []
      }));
      return parsed;
    }
    return {
      categories: DEFAULT_CATEGORIES,
      counters: DEFAULT_COUNTERS,
      tickets: [],
      nextTicketNumber: { '1': 1, '2': 1, '3': 1, '4': 1 }
    };
  });

  const [dbConfig, setDbConfig] = useState<{ usePostgres: boolean, connectionString?: string }>({ usePostgres: false });
  const [isSyncing, setIsSyncing] = useState(false);

  // Load config from backend
  useEffect(() => {
    fetch('/api/config').then(res => res.json()).then(setDbConfig);
  }, []);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      // Set default view based on role
      if (user.role === 'kiosk') setView('kiosk');
      else if (user.role === 'display') setView('tv');
      else if (user.role === 'advisor') setView('advisor');
      else if (user.role === 'admin') setView('admin');
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }, [user]);

  // --- Actions ---
  const createTicket = (categoryId: string, customerDocument?: string) => {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;

    const num = state.nextTicketNumber[categoryId] || 1;
    const newTicket: Ticket = {
      id: crypto.randomUUID(),
      displayId: `${category.prefix}${String(num).padStart(3, '0')}`,
      categoryId,
      customerDocument,
      status: 'waiting',
      createdAt: Date.now(),
    };

    setState(prev => ({
      ...prev,
      tickets: [...prev.tickets, newTicket],
      nextTicketNumber: {
        ...prev.nextTicketNumber,
        [categoryId]: num + 1
      }
    }));

    // Sync with backend
    fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTicket)
    });
    
    return newTicket;
  };

  const updateTicketOnBackend = (id: string, updates: Partial<Ticket>) => {
    fetch(`/api/tickets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  };

  const callNextTicket = (counterId: number) => {
    const waitingTickets = state.tickets
      .filter(t => t.status === 'waiting')
      .sort((a, b) => {
        const catA = state.categories.find(c => c.id === a.categoryId);
        const catB = state.categories.find(c => c.id === b.categoryId);
        if (catA?.prefix === 'P' && catB?.prefix !== 'P') return -1;
        if (catA?.prefix !== 'P' && catB?.prefix === 'P') return 1;
        return a.createdAt - b.createdAt;
      });

    if (waitingTickets.length === 0) return;

    const ticket = waitingTickets[0];
    const now = Date.now();

    setState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t => 
        t.id === ticket.id 
          ? { ...t, status: 'calling', calledAt: now, counterId } 
          : t
      ),
      counters: prev.counters.map(c => 
        c.id === counterId 
          ? { ...c, status: 'busy', currentTicketId: ticket.id } 
          : c
      )
    }));

    updateTicketOnBackend(ticket.id, { status: 'calling', calledAt: now, counterId });
  };

  const startServing = (counterId: number) => {
    const counter = state.counters.find(c => c.id === counterId);
    if (!counter?.currentTicketId) return;

    const now = Date.now();
    setState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t => 
        t.id === counter.currentTicketId 
          ? { ...t, status: 'serving', startedAt: now } 
          : t
      )
    }));

    updateTicketOnBackend(counter.currentTicketId, { status: 'serving', startedAt: now });
  };

  const reprofileTicket = (ticketId: string, subCategoryId: string) => {
    setState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t => 
        t.id === ticketId ? { ...t, subCategoryId } : t
      )
    }));
    updateTicketOnBackend(ticketId, { subCategoryId });
  };

  const completeTicket = (counterId: number, status: 'completed' | 'no-show') => {
    const counter = state.counters.find(c => c.id === counterId);
    if (!counter?.currentTicketId) return;

    const now = Date.now();
    setState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t => 
        t.id === counter.currentTicketId 
          ? { ...t, status, completedAt: now } 
          : t
      ),
      counters: prev.counters.map(c => 
        c.id === counterId 
          ? { ...c, status: 'idle', currentTicketId: undefined } 
          : c
      )
    }));

    updateTicketOnBackend(counter.currentTicketId, { status, completedAt: now });
  };

  const saveDbConfig = (config: typeof dbConfig) => {
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).then(() => setDbConfig(config));
  };

  const setupDb = () => {
    fetch('/api/setup-db', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.error) alert(data.error);
        else alert("Base de datos configurada correctamente");
      });
  };

  const generateData = () => {
    const synthetic = generateSyntheticData(state.categories);
    setState(prev => ({
      ...prev,
      tickets: [...prev.tickets, ...synthetic]
    }));
    
    setIsSyncing(true);
    // Bulk sync with backend
    fetch('/api/tickets/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(synthetic)
    }).then(res => res.json()).then(data => {
      setIsSyncing(false);
      if (data.error) alert("Error al sincronizar con DB: " + data.error);
      else alert(`Sincronización exitosa: ${data.count} turnos registrados en PostgreSQL.`);
    }).catch(err => {
      setIsSyncing(false);
      console.error(err);
    });
  };

  const clearData = () => {
    if (confirm('¿Estás seguro de borrar todo el historial?')) {
      setState(prev => ({ ...prev, tickets: [] }));
    }
  };

  // --- Components ---

  const NavButton = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${active ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider md:hidden">{label}</span>
    </button>
  );

  const DbStatus = () => (
    <div className="hidden md:flex flex-col items-center gap-1 mt-auto mb-4">
      <div className={`w-3 h-3 rounded-full ${dbConfig.usePostgres ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-300'}`} />
      <span className="text-[8px] font-bold uppercase text-slate-400">DB</span>
    </div>
  );

  if (!user) {
    return <LoginView onLogin={setUser} />;
  }

  const allowedViews = {
    admin: ['kiosk', 'advisor', 'tv', 'admin'],
    advisor: ['advisor'],
    kiosk: ['kiosk'],
    display: ['tv']
  }[user.role] || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900">
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-around items-center z-50 md:relative md:border-t-0 md:border-r md:w-20 md:flex-col md:h-screen md:py-8">
        <div className="hidden md:flex flex-col items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <TicketIcon size={20} />
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-2 md:gap-6">
          {allowedViews.includes('kiosk') && (
            <NavButton icon={<Monitor size={24} />} label="Kiosco" active={view === 'kiosk'} onClick={() => setView('kiosk')} />
          )}
          {allowedViews.includes('advisor') && (
            <NavButton icon={<UserRound size={24} />} label="Asesor" active={view === 'advisor'} onClick={() => setView('advisor')} />
          )}
          {allowedViews.includes('tv') && (
            <NavButton icon={<Volume2 size={24} />} label="TV" active={view === 'tv'} onClick={() => setView('tv')} />
          )}
          {allowedViews.includes('admin') && (
            <NavButton icon={<Settings size={24} />} label="Admin" active={view === 'admin'} onClick={() => setView('admin')} />
          )}
        </div>

        <div className="flex flex-col items-center gap-4 mt-auto mb-4">
          <DbStatus />
          <button 
            onClick={() => setUser(null)}
            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          {view === 'kiosk' && allowedViews.includes('kiosk') && <KioskView key="kiosk" categories={state.categories} onIssue={createTicket} />}
          {view === 'advisor' && allowedViews.includes('advisor') && (
            <AdvisorView 
              key="advisor" 
              counters={state.counters} 
              tickets={state.tickets}
              categories={state.categories}
              onCall={callNextTicket}
              onStart={startServing}
              onComplete={completeTicket}
              onReprofile={reprofileTicket}
            />
          )}
          {view === 'tv' && allowedViews.includes('tv') && <TVView key="tv" tickets={state.tickets} counters={state.counters} />}
          {view === 'admin' && allowedViews.includes('admin') && (
            <AdminView 
              key="admin" 
              state={state} 
              setState={setState} 
              dbConfig={dbConfig}
              isSyncing={isSyncing}
              onSaveConfig={saveDbConfig}
              onSetupDb={setupDb}
              onGenerateSynth={generateData}
              onClear={clearData}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-Views ---

function LoginView({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const user = await res.json();
        onLogin(user);
      } else {
        const data = await res.json();
        setError(data.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl space-y-8"
      >
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-200">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">QueueMaster Pro</h1>
          <p className="text-slate-400 font-medium">Inicie sesión para acceder al sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Usuario</label>
              <div className="relative">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                  placeholder="ej. admin"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-500 text-sm font-bold text-center bg-red-50 py-3 rounded-xl border border-red-100"
            >
              {error}
            </motion.p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar al Sistema'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>

        <div className="pt-4 text-center">
          <p className="text-xs text-slate-300 font-medium">
            Consulte con el administrador para obtener sus credenciales.
          </p>
          <div className="mt-4 flex justify-center gap-4 text-[10px] text-slate-200 font-bold uppercase tracking-tighter">
            <span>Kiosco</span>
            <span>Pantallas</span>
            <span>Ventanilla</span>
            <span>Admin</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function KioskView({ categories, onIssue }: { categories: Category[], onIssue: (id: string, doc?: string) => void, key?: React.Key }) {
  const [lastTicket, setLastTicket] = useState<Ticket | null>(null);
  const [document, setDocument] = useState('');
  const [step, setStep] = useState<'id' | 'category'>('id');

  const handleIssue = (id: string) => {
    const ticket = (onIssue as any)(id, document);
    setLastTicket(ticket);
    setTimeout(() => {
      setLastTicket(null);
      setStep('id');
      setDocument('');
    }, 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="max-w-2xl w-full space-y-12">
        <header className="space-y-4">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-200">
            <TicketIcon className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Bienvenido</h1>
          <p className="text-slate-500 text-lg">
            {step === 'id' ? 'Por favor ingrese su documento de identidad' : 'Seleccione el tipo de trámite'}
          </p>
        </header>

        {step === 'id' ? (
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6 max-w-md mx-auto">
            <input 
              type="text" 
              placeholder="Número de Documento" 
              className="w-full px-6 py-4 text-2xl font-bold rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none text-center"
              value={document}
              onChange={e => setDocument(e.target.value)}
            />
            <button 
              disabled={!document}
              onClick={() => setStep('category')}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-xl"
            >
              Continuar
              <ArrowRight size={24} />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleIssue(cat.id)}
                className="group relative overflow-hidden bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-left"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                    <TicketIcon size={24} />
                  </div>
                  <ArrowRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{cat.name}</h3>
                <p className="text-slate-400 text-sm mt-1">Prefijo: {cat.prefix}</p>
                <div className="absolute bottom-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-500" style={{ backgroundColor: cat.color }} />
              </button>
            ))}
            <button 
              onClick={() => setStep('id')}
              className="sm:col-span-2 text-slate-400 hover:text-slate-600 font-medium"
            >
              ← Volver a ingresar documento
            </button>
          </div>
        )}

        <AnimatePresence>
          {lastTicket && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            >
              <div className="bg-white rounded-[40px] p-12 shadow-2xl max-w-sm w-full text-center space-y-6 border border-slate-100">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <p className="text-slate-400 uppercase tracking-widest text-xs font-bold">Su Turno es</p>
                  <h2 className="text-7xl font-black text-slate-900 tracking-tighter">{lastTicket.displayId}</h2>
                  {lastTicket.customerDocument && (
                    <p className="text-slate-400 text-sm mt-2">ID: {lastTicket.customerDocument}</p>
                  )}
                </div>
                <p className="text-slate-500 text-sm">Por favor, espere a ser llamado en la pantalla principal.</p>
                <div className="pt-4">
                  <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: 2, ease: 'linear' }}
                      className="h-full bg-blue-500"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AdvisorView({ counters, tickets, categories, onCall, onStart, onComplete, onReprofile }: { 
  counters: Counter[], 
  tickets: Ticket[],
  categories: Category[],
  onCall: (id: number) => void,
  onStart: (id: number) => void,
  onComplete: (id: number, status: 'completed' | 'no-show') => void,
  onReprofile: (ticketId: string, subCategoryId: string) => void,
  key?: React.Key
}) {
  const [selectedCounterId, setSelectedCounterId] = useState<number | null>(null);
  
  const activeCounter = counters.find(c => c.id === selectedCounterId);
  const activeTicket = tickets.find(t => t.id === activeCounter?.currentTicketId);
  const waitingCount = tickets.filter(t => t.status === 'waiting').length;

  const currentCategory = categories.find(c => c.id === activeTicket?.categoryId);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 md:p-10 max-w-6xl mx-auto space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Panel del Asesor</h1>
          <p className="text-slate-500">Gestione la atención de clientes en su ventanilla</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.location.reload()} 
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 transition-all"
            title="Refrescar datos"
          >
            <Clock size={20} />
          </button>
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl flex items-center gap-2">
              <Users size={18} />
              <span className="font-bold">{waitingCount}</span>
              <span className="text-xs font-medium uppercase">En espera</span>
            </div>
          </div>
        </div>
      </header>

      {!selectedCounterId ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {counters.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCounterId(c.id)}
              className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all text-center space-y-4"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                <UserRound size={32} />
              </div>
              <h3 className="text-xl font-bold">{c.name}</h3>
              <p className="text-slate-400 text-sm">Haga clic para iniciar sesión</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                    <UserRound size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{activeCounter?.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${activeCounter?.status === 'idle' ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        {activeCounter?.status === 'idle' ? 'Disponible' : 'En atención'}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCounterId(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-medium"
                >
                  Cambiar Ventanilla
                </button>
              </div>

              <div className="p-12 text-center space-y-8">
                {activeTicket ? (
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <p className="text-slate-400 uppercase tracking-widest text-xs font-bold">Atendiendo ahora</p>
                      <h2 className="text-8xl font-black text-slate-900 tracking-tighter">{activeTicket.displayId}</h2>
                      {activeTicket.customerDocument && (
                        <p className="text-blue-600 font-bold text-xl">Documento: {activeTicket.customerDocument}</p>
                      )}
                    </div>

                    {/* Re-profiling Section */}
                    {(activeTicket.status === 'serving' || activeTicket.status === 'calling') && (
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-left space-y-4">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2">
                          <Settings size={18} />
                          Tipificación de Atención
                        </h4>
                        {currentCategory?.subCategories && currentCategory.subCategories.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {currentCategory.subCategories.map(sub => (
                              <button
                                key={sub.id}
                                onClick={() => onReprofile(activeTicket.id, sub.id)}
                                className={`px-4 py-3 rounded-xl border font-medium transition-all text-sm ${
                                  activeTicket.subCategoryId === sub.id 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                                }`}
                              >
                                {sub.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl text-center">
                            <p className="text-slate-400 text-sm">No hay sub-categorías configuradas para esta categoría.</p>
                            <p className="text-xs text-slate-400 mt-1">Configure las tipificaciones en el panel de Admin.</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex flex-wrap justify-center gap-4">
                      {activeTicket.status === 'calling' && (
                        <button 
                          onClick={() => onStart(activeCounter!.id)}
                          className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
                        >
                          <CheckCircle2 size={20} />
                          Iniciar Atención
                        </button>
                      )}
                      {activeTicket.status === 'serving' && (
                        <button 
                          onClick={() => onComplete(activeCounter!.id, 'completed')}
                          className="px-8 py-4 bg-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all flex items-center gap-2"
                        >
                          <CheckCircle2 size={20} />
                          Finalizar Turno
                        </button>
                      )}
                      <button 
                        onClick={() => onComplete(activeCounter!.id, 'no-show')}
                        className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                      >
                        <Trash2 size={20} />
                        No se presentó
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 py-12">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <Clock size={40} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-slate-800">Ventanilla Libre</h3>
                      <p className="text-slate-400">Presione el botón para llamar al siguiente cliente</p>
                    </div>
                    <button 
                      onClick={() => onCall(activeCounter!.id)}
                      disabled={waitingCount === 0}
                      className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-3 mx-auto"
                    >
                      <Bell size={24} />
                      Llamar Siguiente
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock size={18} className="text-blue-500" />
                Próximos en espera
              </h4>
              <div className="space-y-3">
                {tickets.filter(t => t.status === 'waiting').slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-700">{t.displayId}</span>
                      {t.customerDocument && <span className="text-[10px] text-slate-400">ID: {t.customerDocument}</span>}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{format(t.createdAt, 'HH:mm')}</span>
                  </div>
                ))}
                {waitingCount === 0 && (
                  <p className="text-center py-8 text-slate-400 text-sm italic">No hay turnos pendientes</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TVView({ tickets, counters }: { tickets: Ticket[], counters: Counter[], key?: React.Key }) {
  const callingTickets = tickets
    .filter(t => t.status === 'calling' || t.status === 'serving')
    .sort((a, b) => (b.calledAt || 0) - (a.calledAt || 0))
    .slice(0, 6);

  const lastCalled = callingTickets[0];

  // Sound effect simulation (visual only in this context)
  useEffect(() => {
    if (lastCalled?.status === 'calling') {
      // In a real app: new Audio('/ding.mp3').play();
    }
  }, [lastCalled?.id]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden"
    >
      <header className="p-8 bg-slate-800/50 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
            <Monitor size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Turnos en Atención</h1>
            <p className="text-slate-400 text-sm font-medium">Por favor, esté atento a su llamado</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono font-bold">{format(new Date(), 'HH:mm:ss')}</div>
          <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">{format(new Date(), 'EEEE, d MMMM')}</div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row p-8 gap-8">
        {/* Main Call Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-800/30 rounded-[40px] border border-white/5 relative overflow-hidden">
          {lastCalled ? (
            <motion.div 
              key={lastCalled.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-8 z-10"
            >
              <div className="space-y-2">
                <p className="text-blue-400 font-black uppercase tracking-[0.3em] text-xl">Turno</p>
                <h2 className="text-[15rem] font-black leading-none tracking-tighter text-white drop-shadow-2xl">
                  {lastCalled.displayId}
                </h2>
              </div>
              <div className="flex items-center justify-center gap-6">
                <div className="h-px w-20 bg-white/20" />
                <p className="text-4xl font-bold text-slate-300 uppercase tracking-widest">
                  Ventanilla {lastCalled.counterId}
                </p>
                <div className="h-px w-20 bg-white/20" />
              </div>
              {lastCalled.status === 'calling' && (
                <motion.div 
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600/20 text-blue-400 rounded-full border border-blue-500/30"
                >
                  <Volume2 size={24} />
                  <span className="font-black uppercase tracking-widest text-sm">Llamando...</span>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="text-slate-600 text-center space-y-4">
              <Clock size={80} strokeWidth={1} />
              <p className="text-2xl font-medium">Esperando nuevos turnos</p>
            </div>
          )}
          
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full -ml-48 -mb-48" />
        </div>

        {/* Sidebar History */}
        <div className="w-full lg:w-96 flex flex-col gap-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 px-4">Últimos llamados</h3>
          <div className="flex-1 space-y-4">
            {callingTickets.slice(1).map(t => (
              <motion.div 
                key={t.id}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 flex items-center justify-between"
              >
                <div>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Turno</p>
                  <h4 className="text-4xl font-black text-white">{t.displayId}</h4>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Ventanilla</p>
                  <h4 className="text-3xl font-bold text-blue-400">{t.counterId}</h4>
                </div>
              </motion.div>
            ))}
            {callingTickets.length <= 1 && (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-[40px]">
                <p className="text-slate-600 font-medium">No hay historial reciente</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <footer className="p-6 bg-blue-600 text-white font-bold text-center overflow-hidden">
        <motion.div 
          animate={{ x: [1000, -1000] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="whitespace-nowrap text-xl uppercase tracking-widest"
        >
          Bienvenidos a QueueMaster Pro • Por favor tome su ticket en el kiosco • Mantenga su distancia de seguridad • Gracias por su paciencia
        </motion.div>
      </footer>
    </motion.div>
  );
}

function AdminView({ state, setState, dbConfig, isSyncing, onSaveConfig, onSetupDb, onGenerateSynth, onClear }: { 
  state: AppState, 
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  dbConfig: { usePostgres: boolean, connectionString?: string },
  isSyncing: boolean,
  onSaveConfig: (config: any) => void,
  onSetupDb: () => void,
  onGenerateSynth: () => void,
  onClear: () => void,
  key?: React.Key
}) {
  const [newCat, setNewCat] = useState({ name: '', prefix: '', color: '#3b82f6' });
  const [localDbConfig, setLocalDbConfig] = useState(dbConfig);
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'advisor' as UserRole, name: '' });

  useEffect(() => {
    fetch('/api/users').then(res => res.json()).then(setUsers);
  }, []);

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.name) return;
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
      const user = await res.json();
      setUsers([...users, user]);
      setNewUser({ username: '', password: '', role: 'advisor', name: '' });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('¿Eliminar usuario?')) {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      }
    }
  };

  useEffect(() => {
    setLocalDbConfig(dbConfig);
  }, [dbConfig]);

  const addCategory = () => {
    if (!newCat.name || !newCat.prefix) return;
    const id = crypto.randomUUID();
    const subCategories = [
      { id: `${id}-1`, name: `sub_${newCat.name.toLowerCase().replace(/\s+/g, '_')}_1` },
      { id: `${id}-2`, name: `sub_${newCat.name.toLowerCase().replace(/\s+/g, '_')}_2` }
    ];
    setState(prev => ({
      ...prev,
      categories: [...prev.categories, { ...newCat, id, subCategories }],
      nextTicketNumber: { ...prev.nextTicketNumber, [id]: 1 }
    }));
    setNewCat({ name: '', prefix: '', color: '#3b82f6' });
  };

  const removeCategory = (id: string) => {
    setState(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id)
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 md:p-10 max-w-4xl mx-auto space-y-10"
    >
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Configuración del Sistema</h1>
        <p className="text-slate-500">Administre usuarios, categorías y base de datos</p>
      </header>

      {/* User Management */}
      <section className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Users className="text-blue-500" />
          Gestión de Usuarios
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <input 
            type="text" 
            placeholder="Nombre" 
            className="px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none"
            value={newUser.name}
            onChange={e => setNewUser({ ...newUser, name: e.target.value })}
          />
          <input 
            type="text" 
            placeholder="Usuario" 
            className="px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none"
            value={newUser.username}
            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            className="px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none"
            value={newUser.password}
            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
          />
          <select 
            className="px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none bg-white"
            value={newUser.role}
            onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
          >
            <option value="admin">Admin</option>
            <option value="advisor">Asesor</option>
            <option value="kiosk">Kiosco</option>
            <option value="display">Pantalla</option>
          </select>
          <button 
            onClick={handleAddUser}
            className="bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={20} />
            Añadir
          </button>
        </div>

        <div className="space-y-2 pt-4">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                  <UserRound size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{u.name} <span className="text-xs font-normal text-slate-400">(@{u.username})</span></p>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-md text-[10px] font-black uppercase tracking-widest">{u.role}</span>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteUser(u.id)}
                className="text-slate-300 hover:text-red-500 transition-colors p-2"
              >
                <UserMinus size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Database Configuration */}
      <section className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Monitor className="text-blue-500" />
          Conexión a Base de Datos (PostgreSQL)
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="usePostgres"
              checked={localDbConfig.usePostgres}
              onChange={e => setLocalDbConfig({ ...localDbConfig, usePostgres: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="usePostgres" className="font-medium text-slate-700">Usar PostgreSQL como backend</label>
          </div>
          
          {localDbConfig.usePostgres && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Connection String</label>
                <input 
                  type="text" 
                  placeholder="postgres://user:pass@host:port/db" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                  value={localDbConfig.connectionString || ''}
                  onChange={e => setLocalDbConfig({ ...localDbConfig, connectionString: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => onSaveConfig(localDbConfig)}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
                >
                  Guardar Configuración
                </button>
                <button 
                  onClick={onSetupDb}
                  className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  Inicializar Tablas
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <TicketIcon className="text-blue-500" />
          Categorías de Trámites
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input 
            type="text" 
            placeholder="Nombre (ej. Caja)" 
            className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
            value={newCat.name}
            onChange={e => setNewCat({ ...newCat, name: e.target.value })}
          />
          <input 
            type="text" 
            placeholder="Prefijo (ej. C)" 
            maxLength={1}
            className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
            value={newCat.prefix}
            onChange={e => setNewCat({ ...newCat, prefix: e.target.value.toUpperCase() })}
          />
          <button 
            onClick={addCategory}
            className="bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Añadir
          </button>
        </div>

        <div className="space-y-4 pt-4">
          {state.categories.map(cat => (
            <div key={cat.id} className="space-y-3 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                  <div>
                    <span className="font-bold text-slate-800 text-lg">{cat.name}</span>
                    <span className="ml-2 text-xs font-bold text-slate-400 uppercase tracking-widest">({cat.prefix})</span>
                  </div>
                </div>
                <button onClick={() => removeCategory(cat.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="space-y-3 pl-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Sub-categorías (Tipificaciones)</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cat.subCategories?.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600">
                      {sub.name}
                      <button 
                        onClick={() => {
                          setState(prev => ({
                            ...prev,
                            categories: prev.categories.map(c => c.id === cat.id ? {
                              ...c,
                              subCategories: c.subCategories?.filter(s => s.id !== sub.id)
                            } : c)
                          }));
                        }}
                        className="text-slate-300 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => {
                      const name = prompt('Nombre de la sub-categoría:');
                      if (name) {
                        setState(prev => ({
                          ...prev,
                          categories: prev.categories.map(c => c.id === cat.id ? {
                            ...c,
                            subCategories: [...(c.subCategories || []), { id: crypto.randomUUID(), name }]
                          } : c)
                        }));
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-sm font-bold text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all"
                  >
                    <Plus size={14} />
                    Añadir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <LayoutDashboard className="text-purple-500" />
          Gestión de Datos
        </h3>
        <p className="text-slate-500 text-sm">Utilice estas herramientas para poblar el sistema con datos de prueba o limpiar el historial.</p>
        
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={onGenerateSynth}
            disabled={isSyncing}
            className="px-6 py-3 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl font-bold hover:bg-purple-100 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <div className="w-4 h-4 border-2 border-purple-700 border-t-transparent rounded-full animate-spin" />
                Sincronizando con DB...
              </>
            ) : (
              <>
                <Plus size={20} />
                Generar 6 meses de datos sintéticos
              </>
            )}
          </button>
          <button 
            onClick={onClear}
            className="px-6 py-3 bg-red-50 text-red-700 border border-red-100 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center gap-2"
          >
            <Trash2 size={20} />
            Borrar todo el historial
          </button>
        </div>
      </section>
    </motion.div>
  );
}

function AnalyticsView({ tickets, categories }: { tickets: Ticket[], categories: Category[], key?: React.Key }) {
  return null;
}

function KPICard({ label, value, icon, trend }: { label: string, value: string | number, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{trend}</span>
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium">{label}</p>
        <h4 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
      </div>
    </div>
  );
}
