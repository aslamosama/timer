import { useState, useEffect, useRef, useMemo } from 'react';

// Core TypeScript Definitions
interface IntervalStep {
  id: string;
  label: string; // e.g., "Run", "Walk", "Sprint"
  duration: number; // in seconds
  color: string; // tailwind color class
}

interface Routine {
  id: string;
  name: string;
  cycles: number; // How many times to repeat the whole sequence
  steps: IntervalStep[];
}

const DEFAULT_ROUTINES: Routine[] = [
  {
    id: 'c25k-w1',
    name: '1m Run / 1.5m Walk (8x)',
    cycles: 8,
    steps: [
      { id: 's1', label: 'Run', duration: 60, color: 'bg-emerald-500 border-emerald-400 text-emerald-950' },
      { id: 's2', label: 'Walk', duration: 90, color: 'bg-indigo-500 border-indigo-400 text-indigo-950' }
    ]
  },
  {
    id: 'pyramid',
    name: 'Pyramid Interval (2x)',
    cycles: 2,
    steps: [
      { id: 'p1', label: 'Run', duration: 90, color: 'bg-emerald-500 border-emerald-400 text-emerald-950' },
      { id: 'p2', label: 'Walk', duration: 90, color: 'bg-indigo-500 border-indigo-400 text-indigo-950' },
      { id: 'p3', label: 'Run', duration: 180, color: 'bg-emerald-500 border-emerald-400 text-emerald-950' },
      { id: 'p4', label: 'Walk', duration: 180, color: 'bg-indigo-500 border-indigo-400 text-indigo-950' }
    ]
  }
];

export default function App() {
  // State variables
  const [routines, setRoutines] = useState<Routine[]>(() => {
    const saved = localStorage.getItem('run_timer_routines');
    return saved ? JSON.parse(saved) : DEFAULT_ROUTINES;
  });
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(routines[0]?.id || '');

  // Running state
  const [isActive, setIsActive] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  // Wake lock preservation reference
  const wakeLockRef = useRef<any>(null);

  const activeRoutine = useMemo(() => {
    return routines.find(r => r.id === selectedRoutineId) || routines[0];
  }, [routines, selectedRoutineId]);

  // Set up initial timing limits when selecting or resetting a routine
  useEffect(() => {
    if (activeRoutine && activeRoutine.steps[currentStepIndex]) {
      setTimeLeft(activeRoutine.steps[currentStepIndex].duration);
    }
  }, [selectedRoutineId, currentStepIndex, activeRoutine]);

  // Persistent Routine Storage Sync
  useEffect(() => {
    localStorage.setItem('run_timer_routines', JSON.stringify(routines));
  }, [routines]);

  // Browser Screen Wake Lock request
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake lock failed:', err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Synthesize Synthetic Beep Sounds (Web Audio API)
  const playBeep = (frequency: number, duration: number) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.error("Audio beep failed to trigger:", e);
    }
  };

  // Primary Timer Engine Loop
  useEffect(() => {
    let interval: any = null;

    if (isActive) {
      requestWakeLock();
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Step or Cycle complete evaluation logic
            const nextStepIndex = currentStepIndex + 1;

            if (nextStepIndex < activeRoutine.steps.length) {
              // Standard step advance
              playBeep(880, 0.4); // High success beep
              setCurrentStepIndex(nextStepIndex);
              return activeRoutine.steps[nextStepIndex].duration;
            } else {
              // Routine complete check
              const nextCycle = currentCycle + 1;
              if (nextCycle <= activeRoutine.cycles) {
                // Advance loop cycle
                playBeep(1200, 0.6); // Higher double-pulse alert
                setCurrentCycle(nextCycle);
                setCurrentStepIndex(0);
                return activeRoutine.steps[0].duration;
              } else {
                // Workout completed fully
                playBeep(440, 1.2);
                setIsActive(false);
                releaseWakeLock();
                resetTimer();
                return 0;
              }
            }
          }

          // Countdown alerts for final 3 seconds
          if (prev <= 4 && prev > 1) {
            playBeep(550, 0.1);
          }

          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
      releaseWakeLock();
    }

    return () => {
      clearInterval(interval);
      releaseWakeLock();
    };
  }, [isActive, currentStepIndex, currentCycle, activeRoutine]);

  const resetTimer = () => {
    setIsActive(false);
    setCurrentCycle(1);
    setCurrentStepIndex(0);
    if (activeRoutine && activeRoutine.steps[0]) {
      setTimeLeft(activeRoutine.steps[0].duration);
    }
  };

  // Routine Form Mutators
  const addNewRoutine = () => {
    const newId = Date.now().toString();
    const newRoutine: Routine = {
      id: newId,
      name: 'Custom Interval Workout',
      cycles: 5,
      steps: [
        { id: Date.now() + '-1', label: 'Run', duration: 60, color: 'bg-emerald-500 border-emerald-400 text-emerald-950' },
        { id: Date.now() + '-2', label: 'Walk', duration: 60, color: 'bg-indigo-500 border-indigo-400 text-indigo-950' }
      ]
    };
    setRoutines([...routines, newRoutine]);
    setSelectedRoutineId(newId);
    resetTimer();
  };

  const deleteRoutine = (id: string) => {
    if (routines.length <= 1) return;
    const remaining = routines.filter(r => r.id !== id);
    setRoutines(remaining);
    setSelectedRoutineId(remaining[0].id);
    resetTimer();
  };

  const updateRoutineMeta = (field: 'name' | 'cycles', value: any) => {
    setRoutines(prev => prev.map(r => {
      if (r.id !== selectedRoutineId) return r;
      return { ...r, [field]: value };
    }));
  };

  const updateStepData = (stepId: string, field: keyof IntervalStep, value: any) => {
    setRoutines(prev => prev.map(r => {
      if (r.id !== selectedRoutineId) return r;
      return {
        ...r,
        steps: r.steps.map(s => s.id === stepId ? { ...s, [field]: value } : s)
      };
    }));
  };

  const addStepToActive = (label: 'Run' | 'Walk') => {
    const color = label === 'Run'
      ? 'bg-emerald-500 border-emerald-400 text-emerald-950'
      : 'bg-indigo-500 border-indigo-400 text-indigo-950';

    setRoutines(prev => prev.map(r => {
      if (r.id !== selectedRoutineId) return r;
      return {
        ...r,
        steps: [...r.steps, { id: Date.now().toString(), label, duration: 60, color }]
      };
    }));
  };

  const removeStepFromActive = (stepId: string) => {
    if (activeRoutine.steps.length <= 1) return;
    setRoutines(prev => prev.map(r => {
      if (r.id !== selectedRoutineId) return r;
      return {
        ...r,
        steps: r.steps.filter(s => s.id !== stepId)
      };
    }));
    resetTimer();
  };

  // Format digital layout clock readout
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentStep = activeRoutine?.steps[currentStepIndex];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 font-mono select-none px-4 py-6 flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col flex-1">

        {/* TOP SELECTOR HUB */}
        <div className="mb-6 bg-[#131a2e] p-3 rounded-xl border border-slate-800 flex gap-2">
          <select
            value={selectedRoutineId}
            onChange={(e) => { setSelectedRoutineId(e.target.value); resetTimer(); }}
            className="flex-1 bg-[#1a233d] text-sm text-slate-300 font-bold px-3 py-2 rounded-lg border border-slate-700 outline-none"
          >
            {routines.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            onClick={addNewRoutine}
            className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold tracking-tight transition-colors"
          >
            + New
          </button>
        </div>

        {/* MAIN VISUAL COUNTDOWN CONTROLLER */}
        <div className="relative flex flex-col items-center justify-center bg-[#131a2e] rounded-3xl p-8 border border-slate-800 shadow-2xl mb-6 flex-1 min-h-[300px]">

          {/* Active Phase Pill Indicator */}
          <div className="absolute top-6 flex flex-col items-center gap-1">
            <span className="text-[10px] tracking-widest uppercase font-bold text-slate-500">Current Phase</span>
            <span className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider border-b-2 ${currentStep?.color || 'bg-slate-700'}`}>
              {currentStep?.label || 'Ready'}
            </span>
          </div>

          {/* Master Clock String */}
          <div className="text-7xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] my-4">
            {formatTime(timeLeft)}
          </div>

          {/* Core Metrics Track Overlay */}
          <div className="flex gap-8 mt-2 text-center w-full max-w-[240px] justify-between border-t border-slate-800/80 pt-4">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Cycle</div>
              <div className="text-xl font-bold text-slate-200">{currentCycle}<span className="text-xs text-slate-600">/{activeRoutine?.cycles}</span></div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Interval</div>
              <div className="text-xl font-bold text-slate-200">{currentStepIndex + 1}<span className="text-xs text-slate-600">/{activeRoutine?.steps.length}</span></div>
            </div>
          </div>

          {/* Interactive Driver Action Triggers */}
          <div className="flex gap-4 w-full mt-8">
            <button
              onClick={() => setIsActive(!isActive)}
              className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest transition-all text-sm cursor-pointer shadow-lg active:scale-98 ${
                isActive
                  ? 'bg-amber-600 hover:bg-amber-500 text-amber-950 shadow-amber-900/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-emerald-900/20'
              }`}
            >
              {isActive ? 'Pause' : 'Start Run'}
            </button>
            <button
              onClick={resetTimer}
              className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors border border-slate-700 active:scale-98"
            >
              Reset
            </button>
          </div>
        </div>

        {/* INTERACTIVE ROUTINE DESIGN ENGINE EDITOR */}
        <div className="bg-[#131a2e] rounded-2xl p-4 border border-slate-800 max-h-[340px] overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Routine Configurator</span>
            {routines.length > 1 && (
              <button
                onClick={() => deleteRoutine(selectedRoutineId)}
                className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
              >
                Delete Routine
              </button>
            )}
          </div>

          {/* Workout configuration values form */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Workout Title</label>
              <input
                type="text"
                value={activeRoutine?.name || ''}
                onChange={(e) => updateRoutineMeta('name', e.target.value)}
                className="w-full bg-[#1a233d] px-3 py-1.5 border border-slate-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Total Repeat Loops (Cycles)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min="1" max="25" step="1"
                    value={activeRoutine?.cycles || 1}
                    onChange={(e) => updateRoutineMeta('cycles', parseInt(e.target.value))}
                    className="flex-1 accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-bold text-indigo-400 w-8 text-right">{activeRoutine?.cycles}x</span>
                </div>
              </div>
            </div>

            {/* Individual Steps Array Rows Map */}
            <div className="pt-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Interval Blocks Loop Sequence</label>
              <div className="space-y-2">
                {activeRoutine?.steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-2 bg-[#1a233d] p-2 rounded-lg border border-slate-800 group">
                    <span className="text-xs text-slate-600 font-bold pr-1">{idx + 1}</span>
                    <input
                      type="text"
                      value={step.label}
                      onChange={(e) => updateStepData(step.id, 'label', e.target.value)}
                      className="w-16 bg-transparent text-xs font-bold text-white focus:outline-none focus:bg-slate-800 rounded px-1"
                    />
                    <input
                      type="range" min="5" max="600" step="5"
                      value={step.duration}
                      onChange={(e) => updateStepData(step.id, 'duration', parseInt(e.target.value))}
                      className="flex-1 accent-slate-400 h-1 bg-slate-800 rounded appearance-none cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-300 w-14 text-right">
                      {Math.floor(step.duration / 60)}m {step.duration % 60}s
                    </span>
                    {activeRoutine.steps.length > 1 && (
                      <button
                        onClick={() => removeStepFromActive(step.id)}
                        className="text-slate-600 hover:text-red-400 text-xs font-black px-1"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Incremental segment builder actions */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => addStepToActive('Run')}
                  className="flex-1 py-1.5 text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-lg hover:bg-emerald-900/60 transition-colors"
                >
                  + Add Run Step
                </button>
                <button
                  onClick={() => addStepToActive('Walk')}
                  className="flex-1 py-1.5 text-xs font-bold bg-indigo-950 text-indigo-400 border border-indigo-900 rounded-lg hover:bg-indigo-900/60 transition-colors"
                >
                  + Add Walk Step
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
