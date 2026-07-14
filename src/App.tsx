import { useState, useEffect, useRef, useMemo } from 'react';

interface IntervalStep {
  id: string;
  label: string; // e.g., "Warmup", "Run", "Walk", "Cooldown"
  duration: number; // in seconds
  color: string; // styling palette
}

interface Routine {
  id: string;
  name: string;
  cycles: number; // Sets of repetitions
  steps: IntervalStep[];
}

const DEFAULT_ROUTINES: Routine[] = [
  {
    id: 'w1',
    name: 'Week 1: 1m Run / 1.5m Walk (8x)',
    cycles: 8,
    steps: [
      { id: 'w1-1', label: 'Run', duration: 60, color: 'emerald' },
      { id: 'w1-2', label: 'Walk', duration: 90, color: 'indigo' }
    ]
  },
  {
    id: 'w2',
    name: 'Week 2: 1.5m Run / 2m Walk (6x)',
    cycles: 6,
    steps: [
      { id: 'w2-1', label: 'Run', duration: 90, color: 'emerald' },
      { id: 'w2-2', label: 'Walk', duration: 120, color: 'indigo' }
    ]
  },
  {
    id: 'w3',
    name: 'Week 3: Pyramid Mix (2x)',
    cycles: 2,
    steps: [
      { id: 'w3-1', label: 'Run', duration: 90, color: 'emerald' },
      { id: 'w3-2', label: 'Walk', duration: 90, color: 'indigo' },
      { id: 'w3-3', label: 'Run', duration: 180, color: 'emerald' },
      { id: 'w3-4', label: 'Walk', duration: 180, color: 'indigo' }
    ]
  },
  {
    id: 'w4',
    name: 'Week 4: 3-5-3-5 Pyramid',
    cycles: 1,
    steps: [
      { id: 'w4-1', label: 'Run', duration: 180, color: 'emerald' },
      { id: 'w4-2', label: 'Walk', duration: 90, color: 'indigo' },
      { id: 'w4-3', label: 'Run', duration: 300, color: 'emerald' },
      { id: 'w4-4', label: 'Walk', duration: 150, color: 'indigo' },
      { id: 'w4-5', label: 'Run', duration: 180, color: 'emerald' },
      { id: 'w4-6', label: 'Walk', duration: 90, color: 'indigo' },
      { id: 'w4-7', label: 'Run', duration: 300, color: 'emerald' }
    ]
  },
  {
    id: 'w5',
    name: 'Week 5: Steady Blocks',
    cycles: 1,
    steps: [
      { id: 'w5-1', label: 'Run', duration: 300, color: 'emerald' },
      { id: 'w5-2', label: 'Walk', duration: 180, color: 'indigo' },
      { id: 'w5-3', label: 'Run', duration: 300, color: 'emerald' },
      { id: 'w5-4', label: 'Walk', duration: 180, color: 'indigo' },
      { id: 'w5-5', label: 'Run', duration: 300, color: 'emerald' }
    ]
  },
  {
    id: 'w6',
    name: 'Week 6: 5-8-5 Interval Blocks',
    cycles: 1,
    steps: [
      { id: 'w6-1', label: 'Run', duration: 300, color: 'emerald' },
      { id: 'w6-2', label: 'Walk', duration: 180, color: 'indigo' },
      { id: 'w6-3', label: 'Run', duration: 480, color: 'emerald' },
      { id: 'w6-4', label: 'Walk', duration: 180, color: 'indigo' },
      { id: 'w6-5', label: 'Run', duration: 300, color: 'emerald' }
    ]
  },
  {
    id: 'w7',
    name: 'Week 7: 25m Steady Run',
    cycles: 1,
    steps: [
      { id: 'w7-1', label: 'Run', duration: 1500, color: 'emerald' }
    ]
  },
  {
    id: 'w8',
    name: 'Week 8: 28m Steady Run',
    cycles: 1,
    steps: [
      { id: 'w8-1', label: 'Run', duration: 1680, color: 'emerald' }
    ]
  },
  {
    id: 'w9',
    name: 'Week 9: 30m Final Milestone',
    cycles: 1,
    steps: [
      { id: 'w9-1', label: 'Run', duration: 1800, color: 'emerald' }
    ]
  }
];

export default function App() {
  const [routines, setRoutines] = useState<Routine[]>(() => {
    try {
      const saved = localStorage.getItem('running_timer_presets');
      return saved ? JSON.parse(saved) : DEFAULT_ROUTINES;
    } catch {
      return DEFAULT_ROUTINES;
    }
  });

  const [selectedId, setSelectedId] = useState<string>(routines[0]?.id || 'w1');
  const [isActive, setIsActive] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Keep screen active on mobile browsers
  const wakeLockRef = useRef<any>(null);

  const activeRoutine = useMemo(() => {
    return routines.find(r => r.id === selectedId) || routines[0];
  }, [routines, selectedId]);

  const playAlertSound = (frequency: number, duration: number, type: 'sine' | 'square' | 'triangle' = 'sine') => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context blocked or unsupported:", e);
    }
  };

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Screen wake lock failed:', err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  useEffect(() => {
    if (activeRoutine && activeRoutine.steps[currentStepIndex]) {
      setTimeLeft(activeRoutine.steps[currentStepIndex].duration);
    }
  }, [selectedId, currentStepIndex, activeRoutine]);

  useEffect(() => {
    localStorage.setItem('running_timer_presets', JSON.stringify(routines));
  }, [routines]);

  useEffect(() => {
    let interval: any = null;

    if (isActive) {
      requestWakeLock();
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          // Transition Alert / Next Step calculations
          if (prev <= 1) {
            const nextStepIndex = currentStepIndex + 1;

            if (nextStepIndex < activeRoutine.steps.length) {
              playAlertSound(880, 0.4, 'triangle'); // Step transition whistle
              setCurrentStepIndex(nextStepIndex);
              return activeRoutine.steps[nextStepIndex].duration;
            } else {
              const nextCycle = currentCycle + 1;
              if (nextCycle <= activeRoutine.cycles) {
                playAlertSound(1100, 0.6, 'sine'); // Set round completed chime
                setCurrentCycle(nextCycle);
                setCurrentStepIndex(0);
                return activeRoutine.steps[0].duration;
              } else {
                playAlertSound(520, 1.2, 'sine'); // Full run completed melody
                setIsActive(false);
                releaseWakeLock();
                resetTimer();
                return 0;
              }
            }
          }

          // Countdown alerts (final 3 seconds)
          if (prev <= 4 && prev > 1) {
            playAlertSound(580, 0.1, 'sine');
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
  }, [isActive, currentStepIndex, currentCycle, activeRoutine, isMuted]);

  const resetTimer = () => {
    setIsActive(false);
    setCurrentCycle(1);
    setCurrentStepIndex(0);
    if (activeRoutine && activeRoutine.steps[0]) {
      setTimeLeft(activeRoutine.steps[0].duration);
    }
  };

  const addNewPreset = () => {
    const newId = Date.now().toString();
    const newPreset: Routine = {
      id: newId,
      name: `Custom Routine #${routines.length - DEFAULT_ROUTINES.length + 1}`,
      cycles: 4,
      steps: [
        { id: `${Date.now()}-1`, label: 'Run', duration: 60, color: 'emerald' },
        { id: `${Date.now()}-2`, label: 'Walk', duration: 90, color: 'indigo' }
      ]
    };
    setRoutines([...routines, newPreset]);
    setSelectedId(newId);
    resetTimer();
  };

  const deletePreset = (idToDelete: string) => {
    if (routines.length <= 1) return;
    const remaining = routines.filter(r => r.id !== idToDelete);
    setRoutines(remaining);
    setSelectedId(remaining[0].id);
    resetTimer();
  };

  const updatePresetMeta = (field: 'name' | 'cycles', value: any) => {
    setRoutines(prev => prev.map(r => {
      if (r.id !== selectedId) return r;
      return { ...r, [field]: value };
    }));
  };

  const updateStepDuration = (stepId: string, secondsDelta: number) => {
    setRoutines(prev => prev.map(r => {
      if (r.id !== selectedId) return r;
      return {
        ...r,
        steps: r.steps.map(s => {
          if (s.id !== stepId) return s;
          const target = Math.max(5, s.duration + secondsDelta);
          return { ...s, duration: target };
        })
      };
    }));
  };

  const updateStepLabel = (stepId: string, label: string) => {
    setRoutines(prev => prev.map(r => {
      if (r.id !== selectedId) return r;
      return {
        ...r,
        steps: r.steps.map(s => s.id === stepId ? { ...s, label } : s)
      };
    }));
  };

  const addPhase = (type: 'Run' | 'Walk') => {
    const color = type === 'Run' ? 'emerald' : 'indigo';
    setRoutines(prev => prev.map(r => {
      if (r.id !== selectedId) return r;
      return {
        ...r,
        steps: [...r.steps, { id: Date.now().toString(), label: type, duration: 60, color }]
      };
    }));
  };

  const removePhase = (stepId: string) => {
    if (activeRoutine.steps.length <= 1) return;
    setRoutines(prev => prev.map(r => {
      if (r.id !== selectedId) return r;
      return {
        ...r,
        steps: r.steps.filter(s => s.id !== stepId)
      };
    }));
    resetTimer();
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const activeStep = activeRoutine?.steps[currentStepIndex];

  // Calculate circular progress indicator value
  const progressRatio = useMemo(() => {
    if (!activeStep) return 1;
    return timeLeft / activeStep.duration;
  }, [timeLeft, activeStep]);

  return (
    <div className="min-h-screen bg-[#070b15] text-slate-200 font-sans flex flex-col items-center justify-start p-4 md:p-8">
      <div className="w-full max-w-md flex flex-col gap-5">

        {/* HEADER BRANDING & PRESETS DROPDOWN */}
        <div className="flex flex-col gap-3 bg-[#11192e] p-4 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex justify-between items-center">
            <h1 className="text-sm tracking-widest font-bold uppercase text-slate-400 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Interval Trainer
            </h1>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              title={isMuted ? "Unmute sounds" : "Mute countdown tones"}
            >
              {isMuted ? (
                <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); resetTimer(); }}
              className="flex-1 bg-[#17223b] text-xs font-bold text-slate-100 rounded-xl px-3 py-2.5 border border-slate-700 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500"
            >
              {routines.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button
              onClick={addNewPreset}
              className="px-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
            >
              <span>+ Custom</span>
            </button>
          </div>
        </div>

        {/* MAIN HUD DISPLAY CLOCK */}
        <div className="relative flex flex-col items-center justify-center bg-[#11192e] rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl overflow-hidden">

          {/* Circular Progress Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-10 flex items-center justify-center">
            <div className="w-[120%] h-[120%] rounded-full border-[20px] border-emerald-500/20 animate-spin" style={{ animationDuration: '60s' }}></div>
          </div>

          {/* Routine Name & Active Step Badge */}
          <div className="flex flex-col items-center gap-1.5 z-10">
            <span className="text-[10px] tracking-widest font-black text-indigo-400 uppercase">
              {activeRoutine?.name}
            </span>
            <div className={`mt-1 px-5 py-1 rounded-full text-xs font-black uppercase tracking-widest border shadow-lg ${
              activeStep?.color === 'emerald'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                : 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
            }`}>
              {activeStep?.label || 'Finished'}
            </div>
          </div>

          {/* Master Countdown Timer Readout */}
          <div className="relative flex items-center justify-center my-8 z-10">
            <svg className="w-56 h-56 transform -rotate-90">
              <circle
                cx="112"
                cy="112"
                r="98"
                stroke="#17223b"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="112"
                cy="112"
                r="98"
                stroke={activeStep?.color === 'emerald' ? '#10b981' : '#6366f1'}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={615}
                strokeDashoffset={615 * (1 - progressRatio)}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-5xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                {formatTime(timeLeft)}
              </span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black mt-1">TIME REMAINING</span>
            </div>
          </div>

          {/* Set Repetitions and Sequence Counters */}
          <div className="flex justify-around w-full max-w-xs border-t border-slate-800/80 pt-5 z-10">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Set / Reps</span>
              <span className="text-lg font-black text-slate-200 mt-0.5">
                {currentCycle}<span className="text-xs text-slate-600">/{activeRoutine?.cycles}</span>
              </span>
            </div>
            <div className="w-[1px] bg-slate-800"></div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Phase</span>
              <span className="text-lg font-black text-slate-200 mt-0.5">
                {currentStepIndex + 1}<span className="text-xs text-slate-600">/{activeRoutine?.steps.length}</span>
              </span>
            </div>
          </div>

          {/* Primary Action Row Controllers */}
          <div className="flex gap-3 w-full mt-6 z-10">
            <button
              onClick={() => setIsActive(!isActive)}
              className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer ${
                isActive
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/40'
                  : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-emerald-950/40'
              }`}
            >
              {isActive ? 'Pause Workout' : 'Start Running'}
            </button>
            <button
              onClick={resetTimer}
              className="px-6 bg-[#17223b] hover:bg-[#202d4f] border border-slate-700 hover:border-slate-600 text-slate-300 font-bold rounded-2xl text-xs uppercase tracking-widest transition-colors active:scale-95"
            >
              Reset
            </button>
          </div>
        </div>

        {/* WORKOUT DESIGN CREATIVE PANEL */}
        <div className="bg-[#11192e] rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Custom Workspace</span>
            {routines.length > 1 && (
              <button
                onClick={() => deletePreset(selectedId)}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors"
              >
                Delete Preset
              </button>
            )}
          </div>

          {/* EDIT WORKOUT META */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Workout Title</label>
              <input
                type="text"
                value={activeRoutine?.name || ''}
                onChange={(e) => updatePresetMeta('name', e.target.value)}
                className="w-full bg-[#17223b] px-3 py-2 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs font-bold text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Set Repetitions</label>
              <div className="flex bg-[#17223b] rounded-xl border border-slate-700 items-center overflow-hidden">
                <button
                  onClick={() => updatePresetMeta('cycles', Math.max(1, activeRoutine.cycles - 1))}
                  className="w-9 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors"
                >
                  -
                </button>
                <span className="flex-1 text-center text-xs font-bold text-white">
                  {activeRoutine?.cycles}
                </span>
                <button
                  onClick={() => updatePresetMeta('cycles', activeRoutine.cycles + 1)}
                  className="w-9 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* INTERVAL SEQUENCE MAP */}
          <div className="flex flex-col gap-2">
            <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Interval Timeline Sequence</label>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 no-scrollbar">
              {activeRoutine?.steps.map((step, idx) => (
                <div key={step.id} className="flex flex-col gap-2 bg-[#17223b] p-3 rounded-xl border border-slate-800 shadow">

                  {/* Step Label Title + Action Header */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-bold">#{idx + 1}</span>
                      <input
                        type="text"
                        value={step.label}
                        onChange={(e) => updateStepLabel(step.id, e.target.value)}
                        className={`w-20 bg-slate-900/40 text-xs font-black rounded px-1.5 py-0.5 outline-none focus:bg-slate-900 ${
                          step.color === 'emerald' ? 'text-emerald-400' : 'text-indigo-400'
                        }`}
                      />
                    </div>
                    {activeRoutine.steps.length > 1 && (
                      <button
                        onClick={() => removePhase(step.id)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Incremental Control Interface */}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      onClick={() => updateStepDuration(step.id, -60)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      -1m
                    </button>
                    <button
                      onClick={() => updateStepDuration(step.id, -10)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      -10s
                    </button>

                    <div className="flex-1 text-center font-bold text-slate-200 text-xs tabular-nums">
                      {Math.floor(step.duration / 60)}m {step.duration % 60}s
                    </div>

                    <button
                      onClick={() => updateStepDuration(step.id, 10)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      +10s
                    </button>
                    <button
                      onClick={() => updateStepDuration(step.id, 60)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      +1m
                    </button>
                  </div>

                </div>
              ))}
            </div>

            {/* Quick Append Phase Prompts */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => addPhase('Run')}
                className="flex-1 py-2 text-xs font-bold bg-emerald-950/40 hover:bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 rounded-xl transition-all active:scale-95"
              >
                + Add Run Block
              </button>
              <button
                onClick={() => addPhase('Walk')}
                className="flex-1 py-2 text-xs font-bold bg-indigo-950/40 hover:bg-indigo-900/30 text-indigo-400 border border-indigo-900/50 rounded-xl transition-all active:scale-95"
              >
                + Add Walk Block
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
