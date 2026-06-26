import { SceneManager } from './engine/SceneManager';
import { Controls } from './engine/Controls';
import { House } from './engine/House';
import { SimulationClock } from './engine/SimulationClock';
import { NPCManager } from './engine/NPCManager';
import { NPCBrain } from './api/NPCBrain';
import { PhysicsWorld } from './engine/Physics';
import { InteractionSystem } from './engine/Interaction';
import { AudioManager } from './engine/Audio';
import { SurveillanceSystem } from './engine/Surveillance';
import { DiarySystem } from './engine/DiaryRoom';
import { NominationSystem } from './simulation/Nominations';
import { TaskSystem } from './engine/TaskSystem';
import { AssetCache } from './engine/AssetCache';
import { AgentRelay } from './engine/AgentRelay';
import { Group, PerspectiveCamera, WebGLRenderer, ACESFilmicToneMapping, Vector3 } from 'three';
import { PrivacyFilter } from './engine/PrivacyFilter';
import { MobileControls } from './engine/MobileControls';
import { SpeechInput } from './engine/SpeechInput';
import { SaveManager } from './engine/SaveManager';
import { TaskRecorder, type ReplayFrame } from './engine/TaskRecorder';
import { VideoCapture } from './engine/VideoCapture';
import { globalTokenTracker } from './utils/TokenCompressor';
import { Narrator } from './engine/Narrator';

const blocker = document.getElementById('blocker')!;
const loadingScreen = document.getElementById('loading-screen')!;
const clockEl = document.getElementById('clock')!;
const dayEl = document.getElementById('day-counter')!;
const npcInfoEl = document.getElementById('npc-info')!;
const dialogueBox = document.getElementById('dialogue-box')!;
const dialogueSpeaker = document.getElementById('dialogue-speaker')!;
const dialogueText = document.getElementById('dialogue-text')!;
const needsContainer = document.getElementById('needs-container')!;
const speedDisplay = document.getElementById('speed-display')!;
const pauseBtn = document.getElementById('pause-btn')!;
const speedUpBtn = document.getElementById('speed-up-btn')!;
const speedDownBtn = document.getElementById('speed-down-btn')!;
const noClipBtn = document.getElementById('noclip-btn')!;
const audioToggleBtn = document.getElementById('audio-toggle-btn')!;
const cctvBtn = document.getElementById('cctv-btn')!;
const eventLog = document.getElementById('event-log')!;
const eventLogContainer = document.getElementById('event-log-container')!;
const camLabel = document.getElementById('cam-label')!;
const tasksBtn = document.getElementById('tasks-btn') as HTMLButtonElement;
const tasksPanel = document.getElementById('tasks-panel')!;
const taskNpcSelect = document.getElementById('task-npc-select') as HTMLSelectElement;
const taskDesc = document.getElementById('task-desc') as HTMLInputElement;
const taskBonus = document.getElementById('task-bonus') as HTMLInputElement;
const taskActivity = document.getElementById('task-activity') as HTMLSelectElement;
const taskDeadline = document.getElementById('task-deadline') as HTMLInputElement;
const taskAssignBtn = document.getElementById('task-assign-btn') as HTMLButtonElement;
const taskList = document.getElementById('task-list')!;
const crosshair = document.getElementById('crosshair')!;
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
const dayRecap = document.getElementById('day-recap')!;
const dayRecapHeader = document.getElementById('day-recap-header')!;
const dayRecapBody = document.getElementById('day-recap-body')!;
const dayRecapClose = document.getElementById('day-recap-close')!;
const mobileTutorial = document.getElementById('mobile-tutorial')!;
const mobileTutorialDismiss = document.getElementById('mobile-tutorial-dismiss')!;
const taskReplayEl = document.getElementById('task-replay')!;
const taskReplayHeader = document.getElementById('task-replay-header')!;
const taskReplayCanvas = document.getElementById('task-replay-canvas') as HTMLCanvasElement;
const taskReplayTimeline = document.getElementById('task-replay-timeline')!;
const taskReplayStatus = document.getElementById('task-replay-status')!;
const taskReplayClose = document.getElementById('task-replay-close')!;
const taskReplaySaveVideo = document.getElementById('task-replay-save-video') as HTMLButtonElement;
const taskReplayDownload = document.getElementById('task-replay-download') as HTMLButtonElement;
const minimapBtn = document.getElementById('minimap-btn') as HTMLButtonElement;
const eventLogToggle = document.getElementById('event-log-toggle') as HTMLButtonElement;
const eventLogHeader = document.getElementById('event-log-header')!;
const interactionPrompt = document.getElementById('interaction-prompt')!;
const npcTagsContainer = document.getElementById('npc-tags-container')!;
const chatInputBar = document.getElementById('chat-input-bar')!;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const chatSend = document.getElementById('chat-send')!;
const chatMic = document.getElementById('chat-mic')!;
const talkBtn = document.getElementById('talk-btn') as HTMLButtonElement;
const tvBtn = document.getElementById('tv-btn') as HTMLButtonElement;
const tvWatermark = document.getElementById('tv-watermark')!;

async function main() {
  const physics = new PhysicsWorld();
  const sceneMgr = new SceneManager(document.body);
  const controls = new Controls(sceneMgr.camera, physics);
  const clock = new SimulationClock();
  const house = new House(physics);
  const brain = new NPCBrain();
  const npcMgr = new NPCManager(house, clock, brain, sceneMgr, physics);

  // Restore saved API key immediately so NPCs use it from the start
  const savedProvider = localStorage.getItem('llm_provider');
  const savedKey = localStorage.getItem('llm_key');
  if (savedProvider && savedKey) {
    brain.setKey(savedProvider as any, savedKey);
    console.log(`🧠 API key restored: ${savedProvider}`);
  }
  const audio = new AudioManager();
  const speechInput = new SpeechInput();
  const surveillance = new SurveillanceSystem();
  const narrator = new Narrator();
  tvBtn.classList.add('hidden'); // hidden until CCTV mode is active
  const diary = new DiarySystem();
  const nominations = new NominationSystem();
  const tasks = new TaskSystem();
  const assetCache = new AssetCache();
  const agentRelay = new AgentRelay();
  const mobile = new MobileControls(document.body);
  const privacyFilter = new PrivacyFilter();
  const saveManager = new SaveManager();
  const taskRecorder = new TaskRecorder();
  const videoCapture = new VideoCapture();

  // Discover local AI agents + cache assets in the background
  agentRelay.discover().then(agents => {
    if (agents.some(a => a.provider === 'ollama')) {
      brain.setRelay(agentRelay);
      console.log('🧠 NPCBrain: Ollama local agent connected.');
    }
  });
  assetCache.ensureTextures();
  assetCache.ensureAvatars();

  sceneMgr.add(house);

  // Load furniture GLB models in background
  house.loadFurnitureAsync();

  const npcGroup = new Group();
  for (const npc of npcMgr.npcs) npcGroup.add(npc);
  sceneMgr.add(npcGroup);
  const interaction = new InteractionSystem(sceneMgr.camera, npcGroup);

  // Link TaskSystem to NPCManager for richer conversation context
  npcMgr.taskSystem = tasks;

  let dialogueTimeout: ReturnType<typeof setTimeout> | null = null;
  let selectedNPC: string | null = null;
  let prevDay = 1;
  let prevHour = -1;
  let nominationAnnounced = false;
  let dayEvents: string[] = [];
  let minimapExpanded = false;
  let lastTaskFocus = ''; // track which NPC we're focusing on for TV mode
  let lastTaskNarration = '';

  // Show mobile tutorial on touch devices
  if ('ontouchstart' in window && !localStorage.getItem('mobile_tutorial_dismissed')) {
    mobileTutorial.classList.remove('hidden');
  }
  mobileTutorialDismiss.onclick = () => {
    mobileTutorial.classList.add('hidden');
    localStorage.setItem('mobile_tutorial_dismissed', 'true');
  };

  dayRecapClose.onclick = () => {
    dayRecap.classList.add('hidden');
  };

  let replayInterval: ReturnType<typeof setInterval> | null = null;
  let replayFrames: ReplayFrame[] = [];
  let replayFrameIdx = 0;
  let replayNpcName = '';
  let replayRenderer: WebGLRenderer | null = null;
  const replayCamera = new PerspectiveCamera(55, 320 / 200, 0.1, 50);
  const replayOffscreen = document.createElement('canvas');
  replayOffscreen.width = 320;
  replayOffscreen.height = 200;

  taskReplayClose.onclick = () => {
    taskReplayEl.classList.add('hidden');
    if (replayInterval) clearInterval(replayInterval);
    replayInterval = null;
    videoCapture.stopRecording();
    cleanupReplayPositions();
  };
  taskReplaySaveVideo.onclick = async () => {
    // Re-save the current replay frames as a video
    if (!replayNpcName || replayFrames.length === 0) return;
    const blob = await videoCapture.stopRecording();
    if (blob && blob.size > 0) {
      const avGLB = npcMgr.avatarGLBMap.get(replayNpcName) ?? 'unknown';
      const currentDay = Math.floor(clock.elapsed / 120) + 1;
      const key = `${replayNpcName}:manual:${Date.now()}`;
      await videoCapture.saveVideo(key, replayNpcName, 'Manual save', blob, avGLB, currentDay);
      taskReplaySaveVideo.textContent = '✅ Saved!';
      taskReplaySaveVideo.dataset.videoKey = key;
    } else {
      // Restart recording since we consumed it
      videoCapture.startRecording(taskReplayCanvas, 8);
    }
  };
  taskReplayDownload.onclick = async () => {
    const key = taskReplaySaveVideo.dataset.videoKey;
    if (key) {
      const record = await videoCapture.loadVideo(key);
      if (record) {
        const url = URL.createObjectURL(record.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-${record.npcName}-${record.day}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  // Cache for replay — reuse across frames so NPC position snapshots don't leak
  let replayPrevPositions: Map<number, { x: number; z: number; y: number }> | null = null;

  function initReplayRenderer() {
    if (replayRenderer) return;
    replayRenderer = new WebGLRenderer({ canvas: replayOffscreen, antialias: true });
    replayRenderer.setPixelRatio(1);
    replayRenderer.setSize(320, 200, false);
    replayRenderer.toneMapping = ACESFilmicToneMapping;
    replayRenderer.toneMappingExposure = 2.8;
    replayRenderer.shadowMap.enabled = true;
    replayRenderer.shadowMap.type = 1;
  }

  function renderReplayFrame3D(frame: ReplayFrame, pct: number) {
    const ctx = taskReplayCanvas.getContext('2d');
    if (!ctx) return;
    initReplayRenderer();
    if (!replayRenderer) return;

    // Snapshot current NPC positions
    if (!replayPrevPositions) {
      replayPrevPositions = new Map();
      for (const npc of npcMgr.npcs) {
        replayPrevPositions.set(npc.id, { x: npc.position.x, z: npc.position.z, y: npc.rotation.y });
      }
    }

    // Temporarily place the target NPC at the recorded position
    const replayNpc = npcMgr.npcs.find(n => n.npcName === replayNpcName);
    if (!replayNpc) return;
    const savedPos = { x: replayNpc.position.x, z: replayNpc.position.z, y: replayNpc.rotation.y };
    replayNpc.position.x = frame.x;
    replayNpc.position.z = frame.z;
    replayNpc.rotation.y = frame.yaw;

    // Position the replay camera to show the NPC in their environment
    const orbitAngle = (replayFrameIdx / Math.max(replayFrames.length, 1)) * Math.PI * 2;
    const radius = 2.8;
    const camX = frame.x + Math.cos(orbitAngle) * radius;
    const camZ = frame.z + Math.sin(orbitAngle) * radius;
    replayCamera.position.set(camX, 1.6, camZ);
    replayCamera.lookAt(frame.x, 1.2, frame.z);
    replayCamera.updateProjectionMatrix();

    replayRenderer.render(sceneMgr.scene, replayCamera);

    // Restore NPC position
    replayNpc.position.x = savedPos.x;
    replayNpc.position.z = savedPos.z;
    replayNpc.rotation.y = savedPos.y;

    // Copy offscreen render to 2D canvas
    ctx.clearRect(0, 0, taskReplayCanvas.width, taskReplayCanvas.height);
    ctx.drawImage(replayOffscreen, 0, 0);

    // Overlay — semi-transparent bar at bottom
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, taskReplayCanvas.height - 48, taskReplayCanvas.width, 48);

    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Day ${frame.day}  Hour ${Math.floor(frame.hour)}`, 8, taskReplayCanvas.height - 30);
    ctx.fillStyle = '#ddd';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${frame.activity}  ·  ${frame.clothing}  ·  ${frame.emotion}`, 8, taskReplayCanvas.height - 12);

    // Progress bar
    ctx.fillStyle = 'rgba(68,136,204,0.3)';
    ctx.fillRect(0, 0, taskReplayCanvas.width, 4);
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(0, 0, taskReplayCanvas.width * pct, 4);
  }

  function cleanupReplayPositions() {
    if (!replayPrevPositions) return;
    for (const npc of npcMgr.npcs) {
      const saved = replayPrevPositions.get(npc.id);
      if (saved) {
        npc.position.x = saved.x;
        npc.position.z = saved.z;
        npc.rotation.y = saved.y;
      }
    }
    replayPrevPositions = null;
  }

  function showTaskReplay(npcName: string, frames: ReplayFrame[], desc: string) {
    taskReplayHeader.textContent = `🎬 Playback: ${npcName} — "${desc}"`;
    replayFrames = frames;
    replayFrameIdx = 0;
    replayNpcName = npcName;
    taskReplayEl.classList.remove('hidden');

    if (replayInterval) clearInterval(replayInterval);
    // Start video recording from the visible canvas
    videoCapture.startRecording(taskReplayCanvas, 8);
    replayInterval = setInterval(() => {
      if (replayFrameIdx >= replayFrames.length) {
        if (replayInterval) clearInterval(replayInterval);
        replayInterval = null;
        taskReplayStatus.textContent = '✅ Replay complete';
        finalizeReplayRecording(npcName, desc);
        return;
      }
      const frame = replayFrames[replayFrameIdx];
      const pct = replayFrames.length > 0 ? replayFrameIdx / replayFrames.length : 0;
      renderReplayFrame3D(frame, pct);

      // Update timeline bar
      let tlBar = taskReplayTimeline.querySelector('#task-replay-timeline-bar');
      if (!tlBar) {
        tlBar = document.createElement('div');
        tlBar.id = 'task-replay-timeline-bar';
        taskReplayTimeline.appendChild(tlBar);
      }
      (tlBar as HTMLElement).style.width = `${pct * 100}%`;

      taskReplayStatus.textContent = `Day ${frame.day}  Hour ${Math.floor(frame.hour)} — ${frame.activity} in ${frame.room}`;
      replayFrameIdx++;
    }, 300);
  }

  async function finalizeReplayRecording(npcName: string, desc: string) {
    const blob = await videoCapture.stopRecording();
    if (blob && blob.size > 0) {
      const avGLB = npcMgr.avatarGLBMap.get(npcName) ?? 'unknown';
      const currentDay = Math.floor(clock.elapsed / 120) + 1;
      const key = `${npcName}:${desc}:${Date.now()}`;
      await videoCapture.saveVideo(key, npcName, desc, blob, avGLB, currentDay);
      taskReplaySaveVideo.dataset.videoKey = key;
      taskReplaySaveVideo.textContent = '✅ Video Saved';
    }
  }

  loadingScreen.classList.add('hidden');

  // Auto-load game if save exists
  saveManager.load().then(saved => {
    if (saved) {
      // Restore clock
      clock.restore(saved.clock);
      prevDay = Math.floor(saved.clock.elapsed / 120); // derive current day from elapsed
      prevHour = Math.floor((saved.clock.elapsed % 120) * 0.2); // derive hour

      // Restore NPCs
      for (const npcData of saved.npcs) {
        const npc = npcMgr.npcs.find(n => n.npcName === npcData.npcName);
        if (npc) saveManager.restoreNPC(npc, npcData);
      }

      // Restore clothing
      npcMgr.npcs[0].clothing.restoreStates(saved.clothing.states);
      npcMgr.npcs[0].clothing.setPrivacyBlur(saved.clothing.privacyBlurEnabled);

      // Restore relationships
      npcMgr.relationships.restoreEdges(saved.relationships);

      // Restore intimacy
      npcMgr.intimacy.restore(saved.intimacy as any);

      // Restore diary
      diary.restoreConfessions(saved.diary.confessions as any);

      // Restore tasks
      tasks.tasks = saved.tasks as any;

      // Restore nominations
      nominations.restore(saved.nominations);

      // Restore conversations
      npcMgr.conversations.length = 0;
      npcMgr.conversations.push(...saved.conversations);

      addEvent('💾 Game restored from save.');
    }
  });

  blocker.addEventListener('click', () => {
    try { controls.lock(); } catch {}
    try { audio.startAmbient(); } catch {}
    try { audio.initSpeech(); } catch {}
    blocker.classList.add('hidden');
  });
  blocker.addEventListener('touchend', (e) => {
    e.preventDefault();
    try { controls.lock(); } catch {}
    try { audio.startAmbient(); } catch {}
    try { audio.initSpeech(); } catch {}
    blocker.classList.add('hidden');
  });

  // Toggle pointer-locked class on body for CSS
  document.addEventListener('pointerlockchange', () => {
    document.body.classList.toggle('pointer-locked', document.pointerLockElement !== null);
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      if (surveillance.tvMode) surveillance.toggleTVMode();
      surveillance.toggle();
      cctvBtn.textContent = surveillance.visible ? '📺 CCTV' : '📺 Cameras';
      tvBtn.classList.toggle('hidden', surveillance.visible);
    }
    if (e.code === 'Escape' && surveillance.visible) {
      surveillance.toggle();
      cctvBtn.textContent = '📺 Cameras';
    }
    // L key: toggle event log
    if (e.code === 'KeyL' && controls.isLocked) {
      eventLogVisible = !eventLogVisible;
      eventLogContainer.classList.toggle('hidden', !eventLogVisible);
      eventLogToggle.classList.toggle('active', eventLogVisible);
    }
    // E key: talk to nearest visible NPC
    if (e.code === 'KeyE' && controls.isLocked) {
      const pos = controls.getPosition();
      const nearby = npcMgr.getClosestNPC(pos, 5);
      if (nearby && !nearby.isEvicted) {
        selectedNPC = nearby.npcName;
        showDialogue(nearby.npcName, `*${nearby.currentActivity} in ${nearby.currentRoom}*`);
        audio.dialogueBlip();
        chatInput.placeholder = `Talk to ${nearby.npcName}...`;
        chatInputBar.classList.remove('hidden');
        chatInput.focus();
      }
    }
    // Escape: close chat input
    if (e.code === 'Escape') {
      chatInputBar.classList.add('hidden');
      speechInput.stop();
    }
  });

  document.addEventListener('click', (e) => {
    if (surveillance.visible) {
      const idx = surveillance.handleClick(e.clientX, e.clientY);
      if (idx >= 0) {
        const feed = surveillance.getFeeds()[idx];
        camLabel.textContent = feed?.name ?? '';
      }
    }
  });

  if (cctvBtn) {
    cctvBtn.onclick = () => {
      if (surveillance.tvMode) surveillance.toggleTVMode();
      surveillance.toggle();
      cctvBtn.textContent = surveillance.visible ? '📺 CCTV' : '📺 Cameras';
      tvBtn.classList.toggle('hidden', surveillance.visible);
    };
  }
  if (tvBtn) {
    tvBtn.onclick = () => {
      surveillance.toggleTVMode();
      tvBtn.classList.toggle('active', surveillance.tvMode);
    };
  }

  // Tasks panel
  if (tasksBtn) {
    tasksBtn.onclick = () => {
      tasksPanel.classList.toggle('hidden');
      // Refresh NPC list
      taskNpcSelect.innerHTML = '<option value="">Select NPC...</option>';
      for (const npc of npcMgr.npcs) {
        if (!npc.isEvicted) {
          const opt = document.createElement('option');
          opt.value = npc.npcName; opt.textContent = npc.npcName;
          taskNpcSelect.appendChild(opt);
        }
      }
      renderTaskList();
    };
  }

  taskAssignBtn.onclick = () => {
    const npc = taskNpcSelect.value;
    const desc = taskDesc.value.trim();
    const bonus = taskBonus.value.trim() || 'Praise from Big Brother';
    const activity = taskActivity.value;
    const deadlineDay = clock.day + Math.max(1, parseInt(taskDeadline.value) || 7);
    if (!npc || !desc) { alert('Select an NPC and describe the task.'); return; }
    tasks.assignTask(npc, desc, bonus, activity, deadlineDay, clock.hours);
    addEvent(`📋 ${npc} — Big Brother task: "${desc}" (bonus: ${bonus}, due Day ${deadlineDay})`);
    taskDesc.value = '';
    renderTaskList();
  };

  function renderTaskList() {
    taskList.innerHTML = tasks.tasks.filter(t => !t.completed && !t.failed)
      .map(t => `<div>📋 ${t.npcName}: "${t.description}" — bonus: ${t.bonus} (due Day ${t.deadlineDay})</div>`)
      .join('') || '<div style="opacity:0.5">No active tasks</div>';
  }

  function sendChatMessage(text: string) {
    if (!selectedNPC) return;
    const npc = npcMgr.npcs.find(n => n.npcName === selectedNPC);
    if (!npc) return;
    chatInputBar.classList.add('hidden');
    chatInput.value = '';
    npc.dialogueHistory.push(`You: ${text}`);
    addEvent(`💬 You → ${npc.npcName}: "${text}"`);
    const physContext = npc.knownPhysicality.size > 0
      ? ` You are ${npc.physicalDesc}. You know: ${[...npc.knownPhysicality.entries()].map(([k, v]) => `${k} is ${v}`).join(', ')}.`
      : ` You are ${npc.physicalDesc}.`;
    brain.think(
      npc.npcName,
      `Respond to what the player just said to you. Player said: "${text}"${physContext}`,
      npc.dialogueHistory.slice(-3),
    ).then(reply => {
      npc.dialogueHistory.push(`${npc.npcName}: ${reply}`);
      showDialogue(npc.npcName, reply);
      audio.dialogueBlip();
    }).catch(() => {
      showDialogue(npc.npcName, "...");
      audio.dialogueBlip();
    });
  }

  chatSend.onclick = () => {
    const text = chatInput.value.trim();
    if (text) sendChatMessage(text);
  };
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = chatInput.value.trim();
      if (text) sendChatMessage(text);
    }
  });
  chatMic.onclick = () => {
    if (!selectedNPC) return;
    const npc = npcMgr.npcs.find(n => n.npcName === selectedNPC);
    if (!npc) return;
    if (speechInput.isListening) {
      speechInput.stop();
      chatMic.classList.remove('listening');
      return;
    }
    chatMic.classList.add('listening');
    speechInput.start((transcript) => {
      chatMic.classList.remove('listening');
      sendChatMessage(transcript);
    });
  };

  interaction.onClick((target) => {
    if (target) {
      selectedNPC = target.npc.npcName;
      showDialogue(target.npc.npcName, `*${target.npc.currentActivity} in ${target.npc.currentRoom}*`);
      audio.dialogueBlip();
      chatInput.placeholder = `Talk to ${target.npc.npcName}...`;
      chatInputBar.classList.remove('hidden');
      chatInput.focus();
    } else if (selectedNPC) {
      selectedNPC = null;
      chatInputBar.classList.add('hidden');
      speechInput.stop();
    }
  });

  // Mobile talk button — trigger chat with nearest NPC
  talkBtn.onclick = () => {
    const pos = controls.getPosition();
    const nearby = npcMgr.getClosestNPC(pos, 8);
    if (nearby && !nearby.isEvicted) {
      selectedNPC = nearby.npcName;
      showDialogue(nearby.npcName, `*${nearby.currentActivity} in ${nearby.currentRoom}*`);
      audio.dialogueBlip();
      chatInput.placeholder = `Talk to ${nearby.npcName}...`;
      chatInputBar.classList.remove('hidden');
      chatInput.focus();
    }
    talkBtn.classList.add('hidden');
  };

  // Mobile tap for NPC interaction

  async function triggerNPCThought(npc: import('./engine/NPC').NPC) {
    npc.lastDialogueTime = performance.now();
    const reply = await brain.think(
      npc.npcName,
      `${npc.currentActivity} in ${npc.currentRoom}, feels ${npc.emotion.primary}`,
      npc.dialogueHistory.slice(-3),
    );
    npc.dialogueHistory.push(`${npc.npcName}: ${reply}`);
    showDialogue(npc.npcName, reply);
    audio.dialogueBlip();
  }

  function showDialogue(speaker: string, text: string, duration = 5000) {
    dialogueSpeaker.textContent = speaker;
    dialogueText.textContent = text;
    dialogueBox.classList.remove('hidden');
    if (dialogueTimeout) clearTimeout(dialogueTimeout);
    dialogueTimeout = setTimeout(() => {
      dialogueBox.classList.add('hidden');
      dialogueTimeout = null;
    }, duration);
    // Speak NPC dialogue aloud
    if (!text.startsWith('*') && !text.startsWith('(')) {
      audio.speak(text);
    }
  }

  function addEvent(message: string) {
    const time = clock.timeString;
    const day = clock.day;
    const el = document.createElement('div');
    el.className = 'event-entry';
    el.innerHTML = `<span class="event-time">Day ${day} ${time}</span> ${message}`;
    eventLog.prepend(el);
    if (eventLog.children.length > 50) eventLog.removeChild(eventLog.lastChild!);
    // Track for day recap if it's a notable event
    if (day === prevDay || day === prevDay + 1) {
      dayEvents.push(message);
    }
  }

  function showDayRecap(day: number, events: string[]) {
    if (events.length === 0) return;
    dayRecapHeader.textContent = `📋 Day ${day - 1} Recap`;
    dayRecapBody.innerHTML = events.slice(-30).map(e =>
      `<div class="recap-entry">${e}</div>`
    ).join('');
    dayRecap.classList.remove('hidden');
  }

  async function runNominations() {
    const intimacyEvents = npcMgr.intimacy.getAllEvents();
    const clothingEvents = npcMgr.npcs.flatMap(n => n.clothing.getEventsFor(n.npcName));
    const result = await nominations.runAIDrivenNominations(
      npcMgr.npcs, npcMgr.relationships,
      intimacyEvents, clothingEvents, tasks.tasks,
      brain,
      dayEvents.slice(-20), // pass recent day events for context
    );

    addEvent(`📣 Week ${result.week} nominations!`);
    for (const n of result.nominations) {
      addEvent(`🗳 ${n.nominator} nominated ${n.target}: "${n.reason}"`);
    }
    addEvent(`⚠️ Eviction candidates: ${result.evictionCandidate1} vs ${result.evictionCandidate2}`);
    addEvent(`🚪 Evicted: ${result.evicted}`);
    nominationAnnounced = true;

    if (result.evicted) {
      const evicted = npcMgr.npcs.find(n => n.npcName === result.evicted);
      if (evicted) {
        evicted.visible = false;
        evicted.isEvicted = true;
        addEvent(`🏠 ${result.evicted} has left the Big Brother house.`);
      }
    }

    // Reset immunity after nominations
    for (const npc of npcMgr.npcs) {
      npc.immunity = false;
    }
  }

  function checkDiaryRoom() {
    const hour = Math.floor(clock.hours);
    if (hour === 15 && prevHour !== 15) {
      for (const npc of npcMgr.npcs) {
        if (nominations.evictedNames.includes(npc.npcName)) continue;
        if (npc.currentRoom === 'Diary Room' || Math.random() < 0.4) {
          const rels: Record<string, number> = {};
          for (const other of npcMgr.npcs) {
            if (other.npcName !== npc.npcName) {
              rels[other.npcName] = npcMgr.relationships.get(npc.npcName, other.npcName);
            }
          }
          const confession = diary.recordConfession(npc.npcName, clock.day, clock.timeString, rels);
          addEvent(`🎙 ${confession.npcName} (Diary Room): "${confession.text}"`);
        }
      }
    }
  }

  function updateNeedsUI() {
    if (selectedNPC) {
      const npc = npcMgr.npcs.find(n => n.npcName === selectedNPC);
      if (npc) {
        needsContainer.innerHTML = '';
        for (const [key, val] of Object.entries(npc.needs.values)) {
          const bar = document.createElement('div');
          bar.className = 'need-bar';
          bar.innerHTML = `
            <span class="need-label">${key}</span>
            <div class="need-track">
              <div class="need-fill" style="width:${val * 100}%; background:hsl(${val * 120}, 70%, 50%)"></div>
            </div>
          `;
          needsContainer.appendChild(bar);
        }
        const mood = document.createElement('div');
        mood.className = 'npc-mood';
        mood.textContent = `mood: ${npc.emotion.primary} (${(npc.emotion.intensity * 100).toFixed(0)}%)`;
        needsContainer.appendChild(mood);
        return;
      }
    }
    needsContainer.innerHTML = '<div class="need-hint">Click an NPC to see their needs</div>';
  }

  function updateControlsUI() {
    if (speedDisplay) speedDisplay.textContent = `${clock.speed}x`;
    if (pauseBtn) pauseBtn.textContent = clock.paused ? '▶' : '⏸';
  }

  if (pauseBtn) pauseBtn.onclick = () => { clock.togglePause(); updateControlsUI(); };
  if (speedUpBtn) speedUpBtn.onclick = () => { clock.setSpeed(Math.min(clock.speed + 0.5, 10)); updateControlsUI(); };
  if (speedDownBtn) speedDownBtn.onclick = () => { clock.setSpeed(Math.max(clock.speed - 0.5, 0.1)); updateControlsUI(); };
  if (noClipBtn) noClipBtn.onclick = () => {
    const nc = controls.toggleNoClip();
    noClipBtn.textContent = nc ? '🔓 Noclip' : '🔒 Noclip';
  };
  if (audioToggleBtn) audioToggleBtn.onclick = () => {
    const on = audio.toggle();
    audioToggleBtn.textContent = on ? '🔊 Audio' : '🔇 Audio';
  };

  minimapBtn.onclick = () => {
    minimapExpanded = !minimapExpanded;
    minimapBtn.classList.toggle('active', minimapExpanded);
    const el = document.getElementById('minimap')!;
    el.style.display = minimapExpanded ? 'block' : 'none';
    if (minimapExpanded) renderMinimap();
  };
  if (window.innerWidth <= 768) document.getElementById('minimap')!.style.display = 'none';

  // Event log toggle + collapsible
  let eventLogVisible = false;
  eventLogToggle.onclick = () => {
    eventLogVisible = !eventLogVisible;
    eventLogContainer.classList.toggle('hidden', !eventLogVisible);
    eventLogToggle.classList.toggle('active', eventLogVisible);
    eventLogToggle.textContent = eventLogVisible ? '📋 Log' : '📋 Log';
  };
  // Stop scroll/touch events on UI panels from reaching 3D controls
  document.querySelectorAll('#event-log, #tasks-panel, #settings-panel, #right-panel, #day-recap-body').forEach(el => {
    el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    el.addEventListener('touchstart', (e) => { if (e.cancelable) e.stopPropagation(); }, { passive: true });
  });

  // Settings panel toggle
  const settingsBtn = document.getElementById('settings-btn')!;
  const settingsPanel = document.getElementById('settings-panel')!;
  const settingsClose = document.getElementById('settings-close')!;
  const settingsSave = document.getElementById('settings-save')!;
  const settingsProvider = document.getElementById('settings-provider') as HTMLSelectElement;
  const settingsApiKey = document.getElementById('settings-api-key') as HTMLInputElement;
  const settingsStatus = document.getElementById('settings-status')!;

  settingsBtn.onclick = () => {
    settingsPanel.classList.toggle('hidden');
  };
  settingsClose.onclick = () => {
    settingsPanel.classList.add('hidden');
  };
  settingsSave.onclick = () => {
    const provider = settingsProvider.value as 'openrouter' | 'gemini' | 'groq' | 'huggingface';
    const key = settingsApiKey.value.trim();
    if (!key) { settingsStatus.textContent = 'Please enter an API key.'; return; }
    brain.setKey(provider, key);
    localStorage.setItem('llm_provider', provider);
    localStorage.setItem('llm_key', key);
    settingsStatus.textContent = '✅ API key saved!';
    settingsApiKey.value = '';
    setTimeout(() => { settingsStatus.textContent = ''; }, 3000);
  };

  eventLogHeader.onclick = () => {
    eventLogContainer.classList.toggle('collapsed');
    const arrow = eventLogHeader.querySelector('span');
    if (arrow) arrow.textContent = eventLogContainer.classList.contains('collapsed') ? '▶' : '▼';
  };

  function applyTaskRewards() {
    const rewards = tasks.getCompletedRewards();
    for (const reward of rewards) {
      const npc = npcMgr.npcs.find(n => n.npcName === reward.npcName);
      if (!npc) continue;
      switch (reward.type) {
        case 'immunity':
          npc.immunity = true;
          addEvent(`🛡 ${npc.npcName} earned immunity from next eviction (task: "${reward.description}")`);
          break;
        case 'luxury':
          npc.luxuryBoost = 48; // 2 game days of boosted mood
          addEvent(`🎁 ${npc.npcName} received a luxury reward (task: "${reward.description}")`);
          break;
        case 'nominate':
          npc.nominatePower += 1;
          addEvent(`🗳 ${npc.npcName} earned the power to nominate a housemate (task: "${reward.description}")`);
          break;
      }
    }
  }

  function renderMinimap() {
    const ctx = minimapCanvas.getContext('2d');
    if (!ctx) return;
    const w = minimapCanvas.width, h = minimapCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, w, h);

    // Scale: house is roughly -6..4 x, -6..6 z
    const scaleX = (x: number) => ((x + 6) / 10) * w;
    const scaleZ = (z: number) => ((-z + 6) / 12) * h;

    // Draw rooms filled with subtle colors
    const rooms = house.rooms;
    const roomColors: Record<string, string> = {
      'Living Room': 'rgba(60,50,40,0.3)',
      'Kitchen': 'rgba(50,50,40,0.3)',
      'Dining Room': 'rgba(50,40,30,0.3)',
      'Bedroom 1': 'rgba(40,30,50,0.3)',
      'Bedroom 2': 'rgba(40,30,50,0.3)',
      'Bedroom 3': 'rgba(40,30,50,0.3)',
      'Bathroom': 'rgba(30,40,50,0.3)',
      'Garden': 'rgba(30,50,30,0.3)',
      'Diary Room': 'rgba(40,40,50,0.3)',
      'Store Room': 'rgba(30,30,30,0.3)',
    };
    ctx.lineWidth = 0.8;
    for (const room of rooms) {
      const x = scaleX(room.x - room.w / 2);
      const y = scaleZ(room.z + room.d / 2);
      const rw = (room.w / 10) * w;
      const rh = (room.d / 12) * h;
      // Fill
      ctx.fillStyle = roomColors[room.name] || 'rgba(40,40,40,0.2)';
      ctx.fillRect(x, y, rw, rh);
      // Outline
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(x, y, rw, rh);
      // Room label
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      const shortName = room.name.replace('Room', '').replace('Bedroom', 'BR').trim();
      ctx.fillText(shortName, x + rw / 2, y + 10);
    }

    // Draw NPCs with names — larger dots, glow, always visible
    ctx.textAlign = 'left';
    for (const npc of npcMgr.npcs) {
      if (!npc.visible || npc.isEvicted) continue;
      const x = scaleX(npc.position.x);
      const y = scaleZ(npc.position.z);
      // Glow
      ctx.fillStyle = npc.npcColor + '40';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      // Dot
      ctx.fillStyle = npc.npcColor;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      // Outline for visibility
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Name label — always visible
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(npc.npcName.substring(0, 10), x + 7, y + 4);
      ctx.shadowBlur = 0;
    }

    // Draw player
    const pos = controls.getPosition();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(scaleX(pos.x), scaleZ(pos.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Player label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText('You', scaleX(pos.x) + 6, scaleZ(pos.z) + 3);
    ctx.shadowBlur = 0;

    // Legend
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, h - 14, w, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Day ${clock.day}  ·  ${npcMgr.npcs.filter(n => !n.isEvicted).length} in house`, 4, h - 4);
  }
  let prevTime = performance.now();
  let hudTimer = 0;
  let lastFootstep = 0;
  let lastConversationEvent = 0;

  function gameLoop(time: number) {
    const dt = Math.min((time - prevTime) / 1000, 0.05);
    prevTime = time;

    clock.update(dt);
    physics.step(dt);
    controls.feedTouch(mobile.getState());

    if (surveillance.activeCamera && surveillance.visible) {
    } else {
      controls.update(dt);
    }

    npcMgr.update(dt);
    agentRelay.update(dt);
    surveillance.updateAspect(window.innerWidth, window.innerHeight);
    surveillance.update(dt);

    // TV mode task focus — track active task NPCs
    if (surveillance.tvMode || surveillance.visible) {
      const activeTasks = tasks.tasks.filter(t => !t.completed && !t.failed);
      if (activeTasks.length > 0) {
        const task = activeTasks[0];
        const taskNpc = npcMgr.npcs.find(n => n.npcName === task.npcName);
        if (taskNpc && taskNpc.visible) {
          // Set focus only when task NPC changes
          if (lastTaskFocus !== taskNpc.npcName) {
            const pos = new Vector3(taskNpc.position.x, 0.5, taskNpc.position.z);
            surveillance.setFocus(taskNpc.npcName, taskNpc.currentRoom, pos);
            narrator.announceTaskStart(taskNpc.npcName, task.description);
            lastTaskFocus = taskNpc.npcName;

            // Narrate reactions from other housemates in the same room
            const onlookers = npcMgr.npcs.filter(n =>
              n !== taskNpc && n.visible && !n.isEvicted &&
              n.currentRoom === taskNpc.currentRoom
            );
            if (onlookers.length > 0) {
              const o = onlookers[Math.floor(Math.random() * onlookers.length)];
              const aff = npcMgr.relationships.get(o.npcName, taskNpc.npcName);
              const reaction = aff > 0.2 ? 'is cheering on' : aff < -0.2 ? 'looks annoyed at' : 'is watching';
              narrator.announceReaction(o.npcName, taskNpc.npcName, reaction);
            }
          } else {
            // Update position each frame for camera tracking
            surveillance.updateFocusPos(new Vector3(taskNpc.position.x, 0.5, taskNpc.position.z));
          }

          // Periodic task progress narration
          const taskKey = `${taskNpc.npcName}:${task.description}`;
          if (lastTaskNarration !== taskKey) {
            lastTaskNarration = taskKey;
            const onlookers = npcMgr.npcs.filter(n =>
              n !== taskNpc && n.visible && !n.isEvicted &&
              n.currentRoom === taskNpc.currentRoom
            );
            narrator.announceTaskProgress(taskNpc.npcName, task.description, taskNpc.currentRoom);
            if (onlookers.length > 0) {
              const ob = onlookers[Math.floor(Math.random() * onlookers.length)];
              const aff2 = npcMgr.relationships.get(ob.npcName, taskNpc.npcName);
              narrator.announceReaction(ob.npcName, taskNpc.npcName,
                aff2 > 0.2 ? 'is loving the show from' : 'is not impressed by');
            }
          }
        }
      } else if (surveillance.tvMode) {
        surveillance.clearFocus();
        lastTaskFocus = '';
        lastTaskNarration = '';
      }
    } else {
      surveillance.clearFocus();
      lastTaskFocus = '';
      lastTaskNarration = '';
    }

    // Render through surveillance camera if active, else player camera
    if (surveillance.activeCamera) {
      sceneMgr.renderWithCamera(surveillance.activeCamera);
    } else {
      sceneMgr.render();
    }
    let privacyIntensity = 0;
    const nearbyNPC = npcMgr.getClosestNPC(controls.getPosition());
    if (nearbyNPC && nearbyNPC.isPrivateState() && controls.isLocked) {
      privacyIntensity = 0.6;
    }
    if (npcMgr.nudeNames.length > 0) {
      privacyIntensity = Math.max(privacyIntensity, 0.3);
    }
    privacyFilter.requestBlur(privacyIntensity);
    privacyFilter.update(dt);

    audio.setAmbientVolume(clock.isNight ? 0.3 : 0.7);

    if (controls.isLocked) {
      if (controls.isMoving && time - lastFootstep > 400) {
        audio.footstep();
        lastFootstep = time;
      }

      // NPCs speak when looked at — no distance limit (eavesdropping anywhere via crosshair)
      const lookTarget = interaction.tick();
      let nearbyNPC: import('./engine/NPC').NPC | null = null;
      if (lookTarget) {
        const npc = lookTarget.npc;
        if (time - npc.lastDialogueTime > 8000) {
          npc.lastDialogueTime = time;
          triggerNPCThought(npc);
        }
        // Show interaction prompt when looking at NPC
        if (lookTarget.distance < 6) {
          interactionPrompt.textContent = `💬 ${npc.npcName} — Press E to talk`;
          interactionPrompt.classList.remove('hidden');
          nearbyNPC = npc;
        } else {
          interactionPrompt.classList.add('hidden');
        }
      } else {
        // Check for nearest NPC for interaction prompt
        const pos = controls.getPosition();
        const nearby = npcMgr.getClosestNPC(pos, 5);
        if (nearby && !nearby.isEvicted) {
          interactionPrompt.textContent = `💬 Press E to talk to ${nearby.npcName}`;
          interactionPrompt.classList.remove('hidden');
          nearbyNPC = nearby;
        } else {
          interactionPrompt.classList.add('hidden');
        }
      }
      // Show/hide mobile talk button when NPC is near
      if (nearbyNPC && 'ontouchstart' in window) {
        talkBtn.classList.remove('hidden');
      } else {
        talkBtn.classList.add('hidden');
      }
    }

    const currentDay = clock.day;
    // Sync recent events to NPCManager for conversation context
    npcMgr.recentEvents = dayEvents;
    if (currentDay !== prevDay) {
      // Show recap of previous day
      showDayRecap(currentDay, dayEvents);
      dayEvents = [];
      prevDay = currentDay;
      addEvent(`☀️ Day ${currentDay} begins in the Big Brother house.`);
      narrator.announceDay(currentDay);
      nominationAnnounced = false;
      // Auto-save on day change
      autoSave();
      // Apply task rewards
      applyTaskRewards();
    }

    const currentHour = Math.floor(clock.hours);
    if (currentHour !== prevHour) {
      prevHour = currentHour;
      checkDiaryRoom();
      if (currentDay > 1 && currentDay >= nominations.nextNominationsDay && !nominationAnnounced) {
        runNominations();
      }
    }

    // Drain NPC conversation events — show as live dialogue (eavesdropping)
    if (npcMgr.conversations.length > 0 && time - lastConversationEvent > 3000) {
      lastConversationEvent = time;
      const conv = npcMgr.conversations[0];
      addEvent(`💬 ${conv.speaker} → ${conv.listener}: "${conv.text}"`);
      showDialogue(`📡 ${conv.speaker} → ${conv.listener}`, conv.text, 6000);
      narrator.announceActivity(conv.speaker, 'chatting with', conv.room);
      npcMgr.conversations.shift();
    }

    // Periodic narrator summary of NPC activities
    if (currentHour !== prevHour && currentHour % 3 === 0) {
      const activeNpcs = npcMgr.npcs.filter(n => n.visible && !n.isEvicted);
      if (activeNpcs.length > 0) {
        const randomNpc = activeNpcs[Math.floor(Math.random() * activeNpcs.length)];
        narrator.announceActivity(randomNpc.npcName, randomNpc.currentActivity, randomNpc.currentRoom);
      }
    }

    // Record NPC state for active tasks (MUST run BEFORE completion check)
    for (const npc of npcMgr.npcs) {
      if (npc.isEvicted) continue;
      const activeTasks = tasks.getTasksFor(npc.npcName);
      for (const task of activeTasks) {
        const frame: ReplayFrame = {
          day: currentDay,
          hour: currentHour,
          room: npc.currentRoom,
          activity: npc.currentActivity,
          emotion: npc.emotion.primary,
          clothing: npc.clothing.getState(npc.npcName),
          x: npc.position.x,
          z: npc.position.z,
          yaw: npc.rotation.y,
        };
        taskRecorder.recordFrame(npc.npcName, task.description, frame);
      }
    }

    // Check task completion for all NPCs
    for (const npc of npcMgr.npcs) {
      if (npc.isEvicted) continue;
      const prevCompleted = tasks.tasks.filter(t => t.npcName === npc.npcName && t.completed).length;
      tasks.checkCompletion(npc.npcName, npc.currentActivity, npc.currentRoom,
        npc.clothing.getState(npc.npcName), currentDay, currentHour);
      const nowCompleted = tasks.tasks.filter(t => t.npcName === npc.npcName && t.completed).length;
      if (nowCompleted > prevCompleted) {
        npc.completedTaskCount += nowCompleted - prevCompleted;
        addEvent(`✅ ${npc.npcName} completed Big Brother's task!`);
        // Show replay of completed task
        const completed = tasks.tasks.filter(t => t.npcName === npc.npcName && t.completed);
        const latest = completed[completed.length - 1];
        if (latest) {
          const replay = taskRecorder.getReplay(npc.npcName, latest.description);
          if (replay && replay.frames.length > 0) {
            showTaskReplay(npc.npcName, replay.frames, latest.description);
          }
        }
      }
    }

    // Auto-nominate NPCs with failed tasks + consequences
    const failed = tasks.getFailedTasks(currentDay, currentHour);
    for (const f of failed) {
      const npc = npcMgr.npcs.find(n => n.npcName === f.npcName);
      if (npc) {
        // Mood penalty for failing
        npc.emotion.intensity = Math.max(0.1, npc.emotion.intensity - 0.2);
        if (npc.emotion.primary !== 'angry' && npc.emotion.primary !== 'sad') {
          npc.emotion.primary = 'anxious';
        }
        // Relationship penalty: everyone dislikes them more for failing
        for (const other of npcMgr.npcs) {
          if (other === npc) continue;
          npcMgr.relationships.adjust(npc.npcName, other.npcName, -0.1);
          npcMgr.relationships.adjust(other.npcName, npc.npcName, -0.1);
        }
        addEvent(`⚠️ ${f.npcName} FAILED Big Brother's task: "${f.description}" — mood crushed, relationships suffer!`);
      }
    }
    // Sync eviction candidates from nominations
    npcMgr.evictionCandidates = nominations.lastResult
      ? [nominations.lastResult.evictionCandidate1, nominations.lastResult.evictionCandidate2].filter(Boolean)
      : [];

    // Periodic status summary every 6 game-hours
    if (currentHour % 6 === 0 && prevHour % 6 !== 0) {
      const showmances = npcMgr.intimacy.getShowmances();
      for (const s of showmances) {
        if (s.level === 'intimate' || s.level === 'showmance') {
          addEvent(`💕 ${s.a} & ${s.b} — ${s.level}`);
        }
      }
      const intimateEvents = npcMgr.intimacy.getAllIntimateEvents().slice(-1);
      for (const ev of intimateEvents) {
        addEvent(`🔞 ${ev.npcA} & ${ev.npcB} — ${ev.description}`);
      }
    }

    hudTimer += dt;
    if (hudTimer > 0.15) {
      hudTimer = 0;
      updateHUD();
      updateNeedsUI();
      renderNPCTags();
    }

    if (surveillance.visible) {
      if (surveillance.tvMode) {
        camLabel.textContent = `📺 LIVE · ${surveillance.activeFeedName}`;
        camLabel.classList.add('tv-mode');
        document.body.classList.add('tv-mode');
        tvWatermark.classList.remove('hidden');
      } else {
        camLabel.textContent = `📺 ${surveillance.activeFeedName} (tap left/right to cycle, 📺 to exit)`;
        camLabel.classList.remove('tv-mode');
        document.body.classList.remove('tv-mode');
        tvWatermark.classList.add('hidden');
      }
    } else {
      camLabel.classList.remove('tv-mode');
      document.body.classList.remove('tv-mode');
      tvWatermark.classList.add('hidden');
      camLabel.textContent = '';
    }

    requestAnimationFrame(gameLoop);
  }

  function updateHUD() {
    clockEl.textContent = `Day ${clock.day}  ${clock.timeString}`;
    dayEl.textContent = clock.isNight ? '🌙 Night' : '☀️ Day';

    const pos = controls.getPosition();
    const room = house.getRoomAt(pos.x, pos.z);
    const nearby = npcMgr.getClosestNPC(pos);

    // Crosshair visibility
    crosshair.classList.toggle('hidden', !controls.isLocked);

    // Minimap
    renderMinimap();

    if (nearby) {
      const clothState = nearby.clothing.getState(nearby.npcName);
      const clothIcon = clothState === 'nude' ? '🔞' : clothState === 'towel' ? '🛁' : clothState === 'sleepwear' ? '🌙' : '👕';
      npcInfoEl.innerHTML = `
        <b>${nearby.npcName}</b> — ${nearby.currentRoom}<br>
        <span style="opacity:0.6">${nearby.currentActivity}</span>
        <span style="opacity:0.4"> | ${nearby.emotion.primary} ${clothIcon} ${clothState}</span>
        ${nearby.immunity ? ' <span style="color:#4c4">🛡 Immune</span>' : ''}
        ${nearby.luxuryBoost > 0 ? ' <span style="color:#fc0">✨ Luxury</span>' : ''}
        ${nearby.nominatePower > 0 ? ' <span style="color:#c4f">🗳 Power</span>' : ''}
      `;
      npcInfoEl.style.opacity = '1';
    } else {
      const roomName = room?.name ?? 'Outside';
      npcInfoEl.innerHTML = `<span style="opacity:0.4">📍 ${roomName}</span>`;
    }
  }

  function renderNPCTags() {
    const camera = sceneMgr.camera;
    const lookTarget = interaction.tick();
    const highlighted = lookTarget?.npc.npcName ?? '';

    npcTagsContainer.innerHTML = '';

    for (const npc of npcMgr.npcs) {
      if (!npc.visible || npc.isEvicted) continue;
      const dx = npc.position.x - camera.position.x;
      const dz = npc.position.z - camera.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 25) continue;

      const worldPos = npc.position.clone();
      worldPos.y += 1.9;
      const projected = worldPos.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

      if (projected.z > 1) continue;

      const tag = document.createElement('div');
      tag.className = 'npc-tag';
      if (npc.npcName === highlighted) tag.classList.add('tag-highlighted');
      // Fade out with distance
      const fade = Math.max(0.3, Math.min(1, 1.5 - dist / 25));
      tag.style.opacity = String(fade);
      tag.style.left = `${x}px`;
      tag.style.top = `${y}px`;
      const clothState = npc.clothing.getState(npc.npcName);
      const clothIcon = clothState === 'nude' ? '🔞' : clothState === 'towel' ? '🛁' : clothState === 'sleepwear' ? '🌙' : '👕';
      const convIcon = npc.conversingWith ? `💬` : '';
      tag.innerHTML = `${npc.npcName}${convIcon} ${clothIcon} <span class="tag-emotion">${npc.emotion.primary}</span>`;
      npcTagsContainer.appendChild(tag);
    }
  }

  requestAnimationFrame(gameLoop);

  addEvent('🏠 Welcome to the Big Brother house!');
  addEvent(`🎙 Housemates: ${npcMgr.npcs.map(n => n.npcName).join(', ')}`);

  function autoSave() {
    // Aggregate clothing states from all NPCs
    const allStates: [string, string][] = npcMgr.npcs.map(n => [n.npcName, n.clothing.getState(n.npcName)]);
    const clothingSys = {
      getAllStates: () => allStates,
      privacyBlurEnabled: npcMgr.npcs[0]?.clothing.privacyBlurEnabled ?? true,
      getEvents: () => npcMgr.npcs.flatMap(n => n.clothing.getEvents()),
      restoreStates: (_s: [string, string][]) => {},
      setPrivacyBlur: (_v: boolean) => {},
    };
    saveManager.save(saveManager.captureState(
      clock, npcMgr.npcs, clothingSys as any,
      npcMgr.relationships, npcMgr.intimacy, diary, tasks, nominations, npcMgr.conversations,
      taskRecorder.getAllEntries(), npcMgr.avatarGLBMap,
    ));
  }

  (window as unknown as Record<string, unknown>).__THEHOUSE = {
    sceneMgr, controls, clock, house, npcMgr, brain, physics, audio,
    surveillance, diary, nominations, privacyFilter,
    interaction, taskRecorder,
    setNPCKey: (provider: 'openrouter' | 'gemini' | 'groq' | 'huggingface', key: string) => {
      brain.setKey(provider, key);
      console.log(`NPC brain: ${provider} key set. Active: ${brain.getActiveProviders().join(', ')}`);
    },
    teleport: (x: number, z: number) => { controls.setPosition(x, z); },
    togglePause: () => clock.togglePause(),
    setSpeed: (s: number) => clock.setSpeed(s),
    runNominations: () => runNominations(),
    assignTask: (npc: string, desc: string, bonus: string, activity: string, deadlineDay: number, deadlineHour: number, room?: string, clothing?: string) => {
      const task = tasks.assignTask(npc, desc, bonus, activity, deadlineDay, deadlineHour, clock.day, clock.hours, room, clothing);
      addEvent(`📋 Big Brother assigns task to ${npc}: "${desc}" — bonus: ${bonus}`);
      renderTaskList();
      return task;
    },
    tasks: () => tasks.tasks,
    npcs: () => npcMgr.npcs.map(n => ({
      name: n.npcName,
      room: n.currentRoom,
      activity: n.currentActivity,
      mood: n.emotion.primary,
      needs: n.needs.values,
      visible: n.visible,
      affinity: Object.fromEntries(
        npcMgr.npcs.filter(o => o.npcName !== n.npcName).map(o => [o.npcName, npcMgr.relationships.get(n.npcName, o.npcName)])
      ),
    })),
    evicted: () => nominations.evictedNames,
    confessions: () => diary.getLatestConfessions(),
    nominationHistory: () => nominations.getNominationHistory(),
    save: () => { autoSave(); addEvent('💾 Game saved.'); },
    load: async () => {
      const saved = await saveManager.load();
      if (saved) {
        clock.restore(saved.clock);
        prevDay = Math.floor(saved.clock.elapsed / 120);
        prevHour = Math.floor((saved.clock.elapsed % 120) * 0.2);
        for (const npcData of saved.npcs) {
          const npc = npcMgr.npcs.find(n => n.npcName === npcData.npcName);
          if (npc) saveManager.restoreNPC(npc, npcData);
        }
        for (const [name, state] of saved.clothing.states) {
          const npc = npcMgr.npcs.find(n => n.npcName === name);
          if (npc) npc.clothing.restoreStates([[name, state]]);
        }
        if (saved.clothing.privacyBlurEnabled !== undefined) {
          npcMgr.npcs[0]?.clothing.setPrivacyBlur(saved.clothing.privacyBlurEnabled);
        }
        npcMgr.relationships.restoreEdges(saved.relationships);
      npcMgr.intimacy.restore(saved.intimacy as any);
        diary.restoreConfessions(saved.diary.confessions as any);
        tasks.tasks = saved.tasks as any;
        nominations.restore(saved.nominations);
        npcMgr.conversations.length = 0;
        npcMgr.conversations.push(...saved.conversations);
        // Restore task recordings
        if (saved.taskRecordings) {
          taskRecorder.restoreEntries(saved.taskRecordings);
        }
        // Restore avatar GLB assignments and reload avatars
        if (saved.npcs) {
          for (const npcData of saved.npcs) {
            if (npcData.avatarGLB) {
              npcMgr.avatarGLBMap.set(npcData.npcName, npcData.avatarGLB);
            }
          }
          // Reload avatars from stored GLB assignments
          npcMgr.reloadAvatars();
        }
        addEvent('💾 Game loaded.');
      }
    },
    deleteSave: async () => { await saveManager.delete(); addEvent('🗑 Save deleted.'); },
    tokenStats: () => { console.log(globalTokenTracker.getStats()); return globalTokenTracker.getStats(); },
    tokenReset: () => { globalTokenTracker.reset(); console.log('📊 Token tracker reset.'); },
  };

  console.log('🏠 The House — Big Brother Simulation');
  console.log('📺 CCTV: Press Tab or click 📺 Cameras');
  console.log('🗳 Nominations: Auto every 7 days, or __THEHOUSE.runNominations()');
  console.log('🎙 Diary room: NPCs confess at 3pm daily');
  console.log('🧠 NPCs converse autonomously 💬');
  console.log('🧠 API: __THEHOUSE.setNPCKey("openrouter"|"gemini"|"groq"|"huggingface", "<key>")');
  console.log('📊 Status: __THEHOUSE.npcs()');
}

main().catch(err => {
  console.error(err);
  loadingScreen.innerHTML = `<p style="color:#f44">Failed: ${err instanceof Error ? err.message : String(err)}</p>`;
});
