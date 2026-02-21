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
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { format, differenceInMinutes, startOfDay, subDays, isWithinInterval } from 'date-fns';
import { Category, Counter, Ticket, AppState, TicketStatus } from './types';
import { generateSyntheticData } from './utils/dataGenerator';

// --- Constants & Defaults ---
const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'General', prefix: 'G', color: '#3b82f6' },
  { id: '2', name: 'Preferencial', prefix: 'P', color: '#ef4444' },
  { id: '3', name: 'Caja', prefix: 'C', color: '#10b981' },
];

const DEFAULT_COUNTERS: Counter[] = [
  { id: 1, name: 'Ventanilla 1', status: 'idle' },
  { id: 2, name: 'Ventanilla 2', status: 'idle' },
  { id: 3, name: 'Ventanilla 3', status: 'idle' },
];

const STORAGE_KEY = 'queuemaster_state';

export default function App() {
  const [view, setView] = useState<'kiosk' | 'advisor' | 'tv' | 'admin' | 'analytics'>('kiosk');
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return {
      categories: DEFAULT_CATEGORIES,
      counters: DEFAULT_COUNTERS,
      tickets: [],
      nextTicketNumber: { '1': 1, '2': 1, '3': 1 }
    };
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // --- Actions ---
  const createTicket = (categoryId: string) => {
    const category = state.categories.find(c => c.id === categoryId);
    if (!category) return;

    const num = state.nextTicketNumber[categoryId] || 1;
    const newTicket: Ticket = {
      id: crypto.randomUUID(),
      displayId: `${category.prefix}${String(num).padStart(3, '0')}`,
      categoryId,
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
    
    return newTicket;
  };

  const callNextTicket = (counterId: number) => {
    // Simple priority: Preferencial first, then oldest
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
  };

  const startServing = (counterId: number) => {
    const counter = state.counters.find(c => c.id === counterId);
    if (!counter?.currentTicketId) return;

    setState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t => 
        t.id === counter.currentTicketId 
          ? { ...t, status: 'serving', startedAt: Date.now() } 
          : t
      )
    }));
  };

  const completeTicket = (counterId: number, status: 'completed' | 'no-show') => {
    const counter = state.counters.find(c => c.id === counterId);
    if (!counter?.currentTicketId) return;

    setState(prev => ({
      ...prev,
      tickets: prev.tickets.map(t => 
        t.id === counter.currentTicketId 
          ? { ...t, status, completedAt: Date.now() } 
          : t
      ),
      counters: prev.counters.map(c => 
        c.id === counterId 
          ? { ...c, status: 'idle', currentTicketId: undefined } 
          : c
      )
    }));
  };

  const generateData = () => {
    const synthetic = generateSyntheticData(state.categories);
    setState(prev => ({
      ...prev,
      tickets: [...prev.tickets, ...synthetic]
    }));
  };

  const clearData = () => {
    if (confirm('¿Estás seguro de borrar todo el historial?')) {
      setState(prev => ({ ...prev, tickets: [] }));
    }
  };

  // --- Components ---

  const Navigation = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-around items-center z-50 md:relative md:border-t-0 md:border-r md:w-20 md:flex-col md:h-screen md:py-8">
      <NavButton icon={<TicketIcon size={24} />} label="Kiosco" active={view === 'kiosk'} onClick={() => setView('kiosk')} />
      <NavButton icon={<UserRound size={24} />} label="Asesor" active={view === 'advisor'} onClick={() => setView('advisor')} />
      <NavButton icon={<Monitor size={24} />} label="TV" active={view === 'tv'} onClick={() => setView('tv')} />
      <NavButton icon={<LayoutDashboard size={24} />} label="Analytics" active={view === 'analytics'} onClick={() => setView('analytics')} />
      <NavButton icon={<Settings size={24} />} label="Admin" active={view === 'admin'} onClick={() => setView('admin')} />
    </nav>
  );

  const NavButton = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${active ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider md:hidden">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900">
      <Navigation />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          {view === 'kiosk' && <KioskView key="kiosk" categories={state.categories} onIssue={createTicket} />}
          {view === 'advisor' && (
            <AdvisorView 
              key="advisor" 
              counters={state.counters} 
              tickets={state.tickets}
              onCall={callNextTicket}
              onStart={startServing}
              onComplete={completeTicket}
            />
          )}
          {view === 'tv' && <TVView key="tv" tickets={state.tickets} counters={state.counters} />}
          {view === 'admin' && (
            <AdminView 
              key="admin" 
              state={state} 
              setState={setState} 
              onGenerateSynth={generateData}
              onClear={clearData}
            />
          )}
          {view === 'analytics' && <AnalyticsView key="analytics" tickets={state.tickets} categories={state.categories} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-Views ---

function KioskView({ categories, onIssue }: { categories: Category[], onIssue: (id: string) => void, key?: React.Key }) {
  const [lastTicket, setLastTicket] = useState<Ticket | null>(null);

  const handleIssue = (id: string) => {
    const ticket = (onIssue as any)(id);
    setLastTicket(ticket);
    setTimeout(() => setLastTicket(null), 1000);
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
          <p className="text-slate-500 text-lg">Seleccione el tipo de trámite para obtener su turno</p>
        </header>

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
        </div>

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
                </div>
                <p className="text-slate-500 text-sm">Por favor, espere a ser llamado en la pantalla principal.</p>
                <div className="pt-4">
                  <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: 5, ease: 'linear' }}
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

function AdvisorView({ counters, tickets, onCall, onStart, onComplete }: { 
  counters: Counter[], 
  tickets: Ticket[],
  onCall: (id: number) => void,
  onStart: (id: number) => void,
  onComplete: (id: number, status: 'completed' | 'no-show') => void,
  key?: React.Key
}) {
  const [selectedCounterId, setSelectedCounterId] = useState<number | null>(null);
  
  const activeCounter = counters.find(c => c.id === selectedCounterId);
  const activeTicket = tickets.find(t => t.id === activeCounter?.currentTicketId);
  const waitingCount = tickets.filter(t => t.status === 'waiting').length;

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
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl flex items-center gap-2">
            <Users size={18} />
            <span className="font-bold">{waitingCount}</span>
            <span className="text-xs font-medium uppercase">En espera</span>
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
                    </div>
                    
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
                    <span className="font-bold text-slate-700">{t.displayId}</span>
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

function AdminView({ state, setState, onGenerateSynth, onClear }: { 
  state: AppState, 
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  onGenerateSynth: () => void,
  onClear: () => void,
  key?: React.Key
}) {
  const [newCat, setNewCat] = useState({ name: '', prefix: '', color: '#3b82f6' });

  const addCategory = () => {
    if (!newCat.name || !newCat.prefix) return;
    const id = crypto.randomUUID();
    setState(prev => ({
      ...prev,
      categories: [...prev.categories, { ...newCat, id }],
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
        <p className="text-slate-500">Administre categorías, ventanillas y datos del sistema</p>
      </header>

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

        <div className="space-y-3 pt-4">
          {state.categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                <div>
                  <span className="font-bold text-slate-800">{cat.name}</span>
                  <span className="ml-2 text-xs font-bold text-slate-400 uppercase tracking-widest">({cat.prefix})</span>
                </div>
              </div>
              <button onClick={() => removeCategory(cat.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 size={18} />
              </button>
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
            className="px-6 py-3 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl font-bold hover:bg-purple-100 transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            Generar 6 meses de datos sintéticos
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
  const stats = useMemo(() => {
    const completed = tickets.filter(t => t.status === 'completed');
    const noShows = tickets.filter(t => t.status === 'no-show');
    
    const tme = completed.reduce((acc, t) => acc + ((t.calledAt || 0) - t.createdAt), 0) / (completed.length || 1);
    const tma = completed.reduce((acc, t) => acc + ((t.completedAt || 0) - (t.startedAt || t.calledAt || 0)), 0) / (completed.length || 1);
    
    const abandonmentRate = (noShows.length / (tickets.length || 1)) * 100;

    // Volume by day (last 30 days)
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), i);
      const start = startOfDay(date).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const count = tickets.filter(t => t.createdAt >= start && t.createdAt < end).length;
      return { date: format(date, 'dd/MM'), count };
    }).reverse();

    // Volume by category
    const categoryData = categories.map(cat => ({
      name: cat.name,
      value: tickets.filter(t => t.categoryId === cat.id).length,
      color: cat.color
    }));

    return {
      tme: Math.round(tme / 60000),
      tma: Math.round(tma / 60000),
      total: tickets.length,
      abandonmentRate: Math.round(abandonmentRate),
      last30Days,
      categoryData
    };
  }, [tickets, categories]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 md:p-10 max-w-7xl mx-auto space-y-8"
    >
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Analytics & KPIs</h1>
        <p className="text-slate-500">Monitoreo de desempeño y flujo de atención</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard label="T. Medio Espera" value={`${stats.tme} min`} icon={<Clock className="text-blue-500" />} trend="+2% vs ayer" />
        <KPICard label="T. Medio Atención" value={`${stats.tma} min`} icon={<CheckCircle2 className="text-green-500" />} trend="-5% vs ayer" />
        <KPICard label="Total Turnos" value={stats.total.toLocaleString()} icon={<Users className="text-purple-500" />} trend="+12% vs mes ant." />
        <KPICard label="Tasa Abandono" value={`${stats.abandonmentRate}%`} icon={<Trash2 className="text-red-500" />} trend="Estable" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xl font-bold">Volumen de Turnos (Últimos 30 días)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.last30Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xl font-bold">Distribución por Trámite</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.categoryData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
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
