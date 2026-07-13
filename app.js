firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let isSignup = false;
let currentUser = null;
let currentData = null;

let selectedMinutes = 15;
let timerSeconds = 900;
let timerInterval = null;
let timerRunning = false;

let currentRoomId = null;
let currentRoomRole = null;
let roomUnsubscribe = null;
let roomTimerInterval = null;
let latestRoomData = null;

const authPage = document.getElementById("authPage");
const mainApp = document.getElementById("mainApp");
const authTitle = document.getElementById("authTitle");
const authBtn = document.getElementById("authBtn");
const switchAuth = document.getElementById("switchAuth");
const usernameInput = document.getElementById("usernameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const authMsg = document.getElementById("authMsg");

const homeScreen = document.getElementById("homeScreen");
const battleScreen = document.getElementById("battleScreen");
const forestScreen = document.getElementById("forestScreen");
const profileScreen = document.getElementById("profileScreen");
const analysisScreen = document.getElementById("analysisScreen");
const archivesScreen = document.getElementById("archivesScreen");
const friendsScreen = document.getElementById("friendsScreen");
const timerPage = document.getElementById("timerPage");
const navButtons = document.querySelectorAll(".navBtn");

function defaultUserData(user, username) {
  return {
    uid: user.uid,
    username: username || "Warrior",
    email: user.email,
    totalStudyMinutes: 0,
    coins: 0,
    gems: 0,
    level: 1,
    totalXP: 0,
    trees: 0,
    deadTrees: 0,
    castleHealth: 100,
    castleDefense: 100,
    armyPower: 0,
    streak: 0,
    lastStudyDate: "",
    subjectStats: {},
    isOnline: false,
    lastActive: 0,
    createdAt: Date.now()
  };
}

function toggleMenu() {
  const drawer = document.getElementById("menuDrawer");
  if (!drawer) return;
  drawer.classList.toggle("menuOpen");
}

function closeMenu() {
  const drawer = document.getElementById("menuDrawer");
  if (!drawer) return;
  drawer.classList.remove("menuOpen");
}

/* ── Presence (online/offline) ───────────────────────── */
let presenceInterval = null;
const PRESENCE_STALE_MS = 90000;

function isUserOnline(data) {
  if (!data || !data.isOnline) return false;
  const last = data.lastActive || 0;
  return (Date.now() - last) < PRESENCE_STALE_MS;
}

function pingPresence(online) {
  if (!currentUser) return;
  db.collection("users").doc(currentUser.uid).update({
    isOnline: online,
    lastActive: Date.now()
  }).catch(function(){});
}

function handleVisibilityChange() {
  if (!currentUser) return;
  pingPresence(document.visibilityState !== "hidden");
}

function goOffline() {
  pingPresence(false);
}

function startPresence() {
  if (!currentUser) return;
  pingPresence(true);

  if (presenceInterval) clearInterval(presenceInterval);
  presenceInterval = setInterval(function(){
    pingPresence(document.visibilityState !== "hidden");
  }, 25000);

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("beforeunload", goOffline);
}

function stopPresence() {
  if (presenceInterval) {
    clearInterval(presenceInterval);
    presenceInterval = null;
  }
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("beforeunload", goOffline);
}

function toggleAccordion(id) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.toggle("accordionOpen");
}

function triggerStatPulse(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("statPulse");
  el.offsetHeight;
  el.classList.add("statPulse");
  el.addEventListener("animationend", function() {
    el.classList.remove("statPulse");
  }, { once: true });
}

function showToast(msg) {
  const existing = document.querySelector(".toastMsg");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toastMsg";
  toast.innerText = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toastVisible"));
  setTimeout(() => {
    toast.classList.remove("toastVisible");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function formatStudyTime(minutes) {
  if (!minutes || minutes < 1) return "0 min";
  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  const m = minutes % 60;
  if (days > 0) {
    if (h > 0 && m > 0) return days + "d " + h + "h " + m + "m";
    if (h > 0) return days + "d " + h + "h";
    if (m > 0) return days + "d " + m + "m";
    return days + "d";
  }
  if (totalHours > 0) {
    return m > 0 ? totalHours + "h " + m + "m" : totalHours + "h";
  }
  return minutes + " min";
}

function getLevelTitle(level) {
  if (level >= 51) return "Legendary Warlord";
  if (level >= 31) return "Kingdom Commander";
  if (level >= 21) return "Elite Focus Warrior";
  if (level >= 11) return "War Tactician";
  if (level >= 6) return "Battle Scholar";
  if (level >= 3) return "Focus Apprentice";
  return "Novice Warrior";
}

switchAuth.onclick = function () {
  isSignup = !isSignup;
  authMsg.innerText = "";

  if (isSignup) {
    authTitle.innerText = "Create Account";
    authBtn.innerText = "Create Account";
    switchAuth.innerText = "Already have account? Login";
    usernameInput.classList.remove("hidden");
  } else {
    authTitle.innerText = "Welcome Back";
    authBtn.innerText = "Continue";
    switchAuth.innerText = "Create account";
    usernameInput.classList.add("hidden");
  }
};

authBtn.onclick = async function () {
  if (window.SFX) SFX.tap();
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  authMsg.innerText = "";

  if (!email || !password) {
    authMsg.innerText = "Enter email and password";
    return;
  }

  if (password.length < 6) {
    authMsg.innerText = "Password must be at least 6 characters";
    return;
  }

  if (isSignup && !username) {
    authMsg.innerText = "Enter username";
    return;
  }

  try {
    authBtn.disabled = true;
    authBtn.innerText = "Please wait...";

    if (isSignup) {
      const result = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection("users").doc(result.user.uid).set(
        defaultUserData(result.user, username)
      );
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
  } catch (error) {
    authMsg.innerText = error.message;
    if (window.SFX) SFX.error();
  }

  authBtn.disabled = false;
  authBtn.innerText = isSignup ? "Create Account" : "Continue";
};

auth.onAuthStateChanged(async function (user) {
  try {
    if (user) {
  resetBattleUI();

  currentUser = user;
  await loadUserData();

authPage.style.display = "none";
mainApp.style.display = "block";
const _dock = document.getElementById('bottomNav');
if (_dock) _dock.style.display = '';
if (window.Animations) Animations.revealMainApp();
if (window.SFX) SFX.success();

showHomeScreen();
await loadActiveBattleRoom();
startPresence();
startBattleInviteListener();
    } else {
      stopPresence();
      stopBattleInviteListener();
      currentUser = null;
      currentData = null;
      authPage.style.display = "block";
      mainApp.style.display = "none";
      const _dock2 = document.getElementById('bottomNav');
      if (_dock2) _dock2.style.display = 'none';
    }
  } catch (error) {
    alert(error.message);
  }
});

async function loadUserData() {
  const ref = db.collection("users").doc(currentUser.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set(defaultUserData(currentUser, "Warrior"));
  }

  const freshSnap = await ref.get();

  currentData = {
    ...defaultUserData(currentUser, "Warrior"),
    ...freshSnap.data()
  };

  updateUI();
  updateAllScreens();
  updateProfileNavBadge();
}

function updateUI() {
  document.getElementById("homeUsername").innerText = currentData.username;
  document.getElementById("homeLevel").innerText = currentData.level;
  document.getElementById("homeCoins").innerText = currentData.coins;
  document.getElementById("homeTotal").innerText = formatStudyTime(currentData.totalStudyMinutes);
  document.getElementById("forestCount").innerText = currentData.trees + " Trees";
  document.getElementById("armyPower").innerText = currentData.armyPower + " Power";
  document.getElementById("streakText").innerText = currentData.streak + " Days";
  document.getElementById("castleHealthText").innerText = currentData.castleHealth + "%";
  document.getElementById("castleProgress").style.width = currentData.castleHealth + "%";
  const armyBtn = document.getElementById("armyUpgradeBtn");
const defenseBtn = document.getElementById("defenseUpgradeBtn");

if(armyBtn){
  armyBtn.innerText = getArmyUpgradeCost() + " Coins";
}

if(defenseBtn){
  defenseBtn.innerText = getDefenseUpgradeCost() + " Coins";
}
}

function hideAllScreens() {
  homeScreen.style.display = "none";
  battleScreen.style.display = "none";
  forestScreen.style.display = "none";
  profileScreen.style.display = "none";
  if (analysisScreen) analysisScreen.style.display = "none";
  if (archivesScreen) archivesScreen.style.display = "none";
  if (friendsScreen) friendsScreen.style.display = "none";
}

function clearNav() {
  navButtons.forEach(btn => btn.classList.remove("activeNav"));
}

function showHomeScreen() {
  hideAllScreens();
  clearNav();
  navButtons[0].classList.add("activeNav");
  homeScreen.style.display = "block";
  if (window.Animations) Animations.revealScreen(homeScreen);
}

function showBattleScreen() {
  hideAllScreens();
  clearNav();
  navButtons[1].classList.add("activeNav");
  battleScreen.style.display = "block";
  if (window.Animations) Animations.revealScreen(battleScreen);
}

function showForestScreen() {
  hideAllScreens();
  clearNav();
  navButtons[2].classList.add("activeNav");
  forestScreen.style.display = "block";
  if (window.Animations) Animations.revealScreen(forestScreen);
}

function showProfileScreen() {
  hideAllScreens();
  clearNav();
  navButtons[3].classList.add("activeNav");
  profileScreen.style.display = "block";
  updateProfileUI();
  loadFriendSystem();
  if (window.Animations) Animations.revealScreen(profileScreen);
}

function showAnalysisScreen() {
  closeMenu();
  hideAllScreens();
  clearNav();
  navButtons[4].classList.add("activeNav");
  analysisScreen.style.display = "block";
  updateAnalysisUI();
  if (window.Animations) Animations.revealScreen(analysisScreen);
}

function showFriendsScreen() {
  if (!friendsScreen) return;
  closeMenu();
  hideAllScreens();
  clearNav();
  friendsScreen.style.display = "block";
  loadFriendSystem();
  if (window.Animations) Animations.revealScreen(friendsScreen);
}

window.showFriendsScreen = showFriendsScreen;

function switchScreen(screenId) {
  hideAllScreens();
  document.getElementById(screenId).style.display = "block";
}

navButtons[0].onclick = showHomeScreen;
navButtons[1].onclick = showBattleScreen;
navButtons[2].onclick = showForestScreen;
navButtons[3].onclick = showProfileScreen;
navButtons[4].onclick = showAnalysisScreen;

function updateProfileUI() {
  if (!currentData) return;

  document.getElementById("profileUsername").innerText = currentData.username;
  document.getElementById("profileSubtitle").innerText = getLevelTitle(currentData.level || 1);
  document.getElementById("profileStudy").innerText =
    formatStudyTime(Math.round(currentData.totalStudyMinutes || 0));
  document.getElementById("profileCoins").innerText = currentData.coins;
  document.getElementById("profileArmy").innerText = currentData.armyPower;
  document.getElementById("profileLevel").innerText = currentData.level;
  document.getElementById("profileXP").innerText =
    Math.round(currentData.totalXP || 0);
    const totalXP = currentData.totalXP || 0;

const currentLevel = currentData.level || 1;

const currentLevelXP =
  getXPRequired(currentLevel - 1);

const nextLevelXP =
  getXPRequired(currentLevel);

const progressXP =
  totalXP - currentLevelXP;

const neededXP =
  nextLevelXP - currentLevelXP;

const progressPercent =
  (progressXP / neededXP) * 100;

document.getElementById("xpProgressText").innerText =
  `${Math.round(progressXP)} / ${neededXP} XP`;

document.getElementById("xpFill").style.width =
  `${progressPercent}%`;
}

function updateForestUI() {
  if (!currentData) return;

  document.getElementById("forestTreeCount").innerText =
    currentData.trees || 0;

  document.getElementById("deadTreeCount").innerText =
    currentData.deadTrees || 0;

  renderForestTrees();
}

function updateBattleUI() {
  if (!currentData) return;

  document.getElementById("battleArmyText").innerText = currentData.armyPower;
  document.getElementById("battleCastleText").innerText = currentData.castleHealth;
  triggerStatPulse("battleArmyText");
  triggerStatPulse("battleCastleText");
}

function updateAllScreens() {
  updateProfileUI();
  updateForestUI();
  updateBattleUI();
  updateAnalysisUI();
}

function updateAnalysisUI() {
  const list = document.getElementById("analysisSubjectList");
  const empty = document.getElementById("analysisEmptyState");
  const totalEl = document.getElementById("analysisTotalTime");
  const subjectCountEl = document.getElementById("analysisSubjectCount");
  if (!list) return;

  const stats = (currentData && currentData.subjectStats) || {};
  const subjects = Object.keys(stats).filter(s => stats[s] > 0);

  const totalMinutes = subjects.reduce((sum, s) => sum + stats[s], 0);
  if (totalEl) totalEl.innerText = formatStudyTime(totalMinutes);
  if (subjectCountEl) subjectCountEl.innerText = subjects.length;

  list.innerHTML = "";

  if (subjects.length === 0) {
    if (empty) empty.style.display = "flex";
    list.style.display = "none";
    return;
  }

  if (empty) empty.style.display = "none";
  list.style.display = "flex";

  subjects.sort((a, b) => stats[b] - stats[a]);
  const maxMinutes = stats[subjects[0]] || 1;
  const palette = ["#d4af37", "#7c9cff", "#5fd6a6", "#e57373", "#c98bf0", "#4fc3f7", "#ffb74d"];

  subjects.forEach((subject, i) => {
    const minutes = stats[subject];
    const pct = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0;
    const barPct = Math.max(4, Math.round((minutes / maxMinutes) * 100));
    const color = palette[i % palette.length];

    const row = document.createElement("div");
    row.className = "analysisRow";
    row.innerHTML =
      '<div class="analysisRowTop">' +
        '<span class="analysisRowName">' + escapeHtml(subject) + '</span>' +
        '<span class="analysisRowMeta">' + formatStudyTime(minutes) + ' &middot; ' + pct + '%</span>' +
      '</div>' +
      '<div class="analysisBarTrack">' +
        '<div class="analysisBarFill" style="width:' + barPct + '%;background:' + color + '"></div>' +
      '</div>';
    list.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.innerText = str;
  return div.innerHTML;
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
  const seconds = (timerSeconds % 60).toString().padStart(2, "0");
  const el = document.getElementById("timerDisplay");
  if (!el) return;
  const newText = minutes + ":" + seconds;
  if (el.innerText !== newText) {
    el.innerText = newText;
    el.classList.remove("timerFlip");
    void el.offsetWidth;
    el.classList.add("timerFlip");
  }
}

let currentSessionSubject = "";

updateTimerDisplay();
updateSessionPreview();

function selectMinutes(minutes) {
  selectedMinutes = minutes;
  timerSeconds = minutes * 60;
  updateTimerDisplay();
  updateSessionPreview();
}

window.selectMinutes = selectMinutes;

function selectCustom(){
  const value = Number(
    document.getElementById("customMinutes").value
  );

  if(!value || value <= 0){
    showToast("Enter a valid number of minutes");
    return;
  }

  selectedMinutes = Math.round(value);
  timerSeconds = selectedMinutes * 60;
  updateTimerDisplay();
  updateSessionPreview();
}

window.selectCustom = selectCustom;

let customInputOpen = false;

function toggleCustomInput() {
  const wrap = document.getElementById("customInputWrap");
  const btn  = document.getElementById("customToggleBtn");
  const icon = document.getElementById("customToggleIcon");
  const lbl  = document.getElementById("customToggleLabel");
  const inp  = document.getElementById("customMinutes");
  if (!wrap) return;

  customInputOpen = !customInputOpen;

  if (customInputOpen) {
    wrap.classList.add("open");
    btn.classList.add("active");
    icon.className = "ri-check-line";
    lbl.textContent = "Set Custom";
    setTimeout(() => inp && inp.focus(), 350);
  } else {
    selectCustom();
    wrap.classList.remove("open");
    btn.classList.remove("active");
    icon.className = "ri-edit-line";
    lbl.textContent = "Use Custom";
  }
  if (window.SFX) SFX.tap();
}

function resetCustomInput() {
  customInputOpen = false;
  const wrap = document.getElementById("customInputWrap");
  const btn  = document.getElementById("customToggleBtn");
  const icon = document.getElementById("customToggleIcon");
  const lbl  = document.getElementById("customToggleLabel");
  if (wrap) wrap.classList.remove("open");
  if (btn)  btn.classList.remove("active");
  if (icon) icon.className = "ri-edit-line";
  if (lbl)  lbl.textContent = "Use Custom";
}

window.toggleCustomInput = toggleCustomInput;

function openTimer() {
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      timerPage.classList.add("timerSlideUp");
    });
  });
  if (window.SFX) SFX.nav();
}

window.toggleSFXFromMenu = function(el) {
  if (!window.SFX) return;
  const on = SFX.toggle();
  const badge = document.getElementById("sfxMenuBadge");
  if (badge) {
    badge.textContent = on ? "ON" : "OFF";
    badge.classList.toggle("sfxOn", on);
  }
  if (on) SFX.tap();
};

window.openTimer = openTimer;

function closeTimer() {
  if (timerRunning) {
    showToast("Session in progress — give up first to leave");
    if (window.SFX) SFX.error();
    return;
  }
  timerPage.classList.remove("timerSlideUp");
  resetCustomInput();
}

window.closeTimer = closeTimer;

function startTimer() {
  if (timerRunning) return;
  currentSessionSubject = (document.getElementById("subjectInput") || {}).value || "";
  if (window.SFX) SFX.timerStart();
  timerRunning = true;
  timerSeconds = selectedMinutes * 60;
  updateTimerDisplay();

  const subjectWrap = document.getElementById("subjectWrap");
  const timeGrid    = document.getElementById("timeGrid");
  const customWrap  = document.getElementById("customInputWrap");
  const customBtn   = document.getElementById("customToggleBtn");
  if (subjectWrap) subjectWrap.style.display = "none";
  if (timeGrid)    timeGrid.style.opacity = "0.3";
  if (timeGrid)    timeGrid.style.pointerEvents = "none";
  if (customWrap)  customWrap.classList.remove("open");
  if (customBtn)   customBtn.style.display = "none";

  document.getElementById("startTimerBtn").classList.add("hiddenPage");
  document.getElementById("quitSoloBtn").classList.remove("hiddenPage");

  timerInterval = setInterval(function () {
    timerSeconds--;
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      completeSession();
    }
  }, 1000);
}

window.startTimer = startTimer;

async function completeSession() {
  clearInterval(timerInterval);
  timerRunning = false;
  if (window.SFX) SFX.timerEnd();
const today = getTodayDateString();

const yesterdayDate = new Date();
yesterdayDate.setDate(yesterdayDate.getDate() - 1);

const yesterday =
  yesterdayDate.getFullYear() + "-" +
  String(yesterdayDate.getMonth() + 1).padStart(2,"0") + "-" +
  String(yesterdayDate.getDate()).padStart(2,"0");

let streak = currentData.streak || 0;

if(currentData.lastStudyDate === today){

  // same day → keep streak

}
else if(currentData.lastStudyDate === yesterday){

  streak += 1;

}
else{

  streak = 1;
}
  let gainedXP =
    getXPForSession(selectedMinutes);

  const streakBonus =
    getStreakBonusPercent();

  gainedXP += Math.floor(
    gainedXP * (streakBonus / 100)
  );

  const totalXP = (currentData.totalXP || 0) + gainedXP;

  const studyMinutes = (currentData.totalStudyMinutes || 0) + selectedMinutes;

  const gainedCoins = Math.floor(selectedMinutes * 1.5);

  const coins = (currentData.coins || 0) + gainedCoins;

  let treeGain = 0;

  if(selectedMinutes >= 15){
    treeGain = 1;
  }

  if(selectedMinutes >= 60){
    treeGain = 2;
  }

  if(selectedMinutes >= 120){
    treeGain = 3;
  }

  const trees = (currentData.trees || 0) + treeGain;

  let tree = "None";

  if(selectedMinutes >= 15){
    tree = "Seed";
  }

  if(selectedMinutes >= 30){
    tree = "Young Tree";
  }

  if(selectedMinutes >= 60){
    tree = "Full Tree";
  }

  if(selectedMinutes >= 120){
    tree = "Rare Tree";
  }

  const army = (currentData.armyPower || 0) + Math.floor(selectedMinutes / 5);

  const level = calculateLevel(totalXP);

  const subjectKey = (currentSessionSubject || "").trim() || "General";
  const subjectStats = { ...(currentData.subjectStats || {}) };
  subjectStats[subjectKey] = (subjectStats[subjectKey] || 0) + selectedMinutes;

  await db.collection("users").doc(currentUser.uid).update({
  totalStudyMinutes: studyMinutes,
  totalXP: totalXP,
  coins: coins,
  trees: trees,
  armyPower: army,
  level: level,
  streak: streak,
  lastStudyDate: today,
  subjectStats: subjectStats
});

const earnedTreeType =
  getTreeTypeFromMinutes(selectedMinutes);

if(earnedTreeType){
  const oldForestTrees =
    currentData.forestTrees || [];

  if(oldForestTrees.length < forestSpots.length){
    const spot =
      forestSpots[oldForestTrees.length];

    const newForestTree = {
      id: Date.now().toString(),
      type: earnedTreeType,
      x: spot.x,
      y: spot.y,
      minutes: selectedMinutes,
      createdAt: Date.now()
    };

    await db.collection("users").doc(currentUser.uid).update({
      forestTrees: [
        ...oldForestTrees,
        newForestTree
      ]
    });
  }
}

  await loadUserData();

  document.getElementById("startTimerBtn").classList.remove("hiddenPage");
  document.getElementById("quitSoloBtn").classList.add("hiddenPage");
  restoreTimerUI();

  showRewardModal({
    minutes: selectedMinutes,
    xp: gainedXP,
    coins: gainedCoins,
    tree: tree,
    streakBonus: streakBonus
  });
}

function generateRoomId() {
  return "SB" + Math.floor(100000 + Math.random() * 900000);
}

async function createBattleRoom() {
  const targetHours = Number(document.getElementById("battleTargetHours").value);
  const password = document.getElementById("battlePassword").value.trim();

  if (!targetHours || targetHours <= 0) {
    alert("Enter valid target hours");
    return;
  }

  const roomId = generateRoomId();

  await db.collection("battleRooms").doc(roomId).set({
    roomId,
    targetHours,
    password,
    status: "waiting",

    attackerUid: currentUser.uid,
    attackerName: currentData.username,
    attackerConfirmed: false,
    attackerConfirmedAt: null,
    attackerLeft: false,
    attackerLeftAt: null,

    defenderUid: null,
    defenderName: null,
    defenderConfirmed: false,
    defenderConfirmedAt: null,
    defenderLeft: false,
    defenderLeftAt: null,

    createdAt: Date.now(),
    startedAt: null,
confirmDeadlineAt: null,
endedAt: null,
scorecard: null,
participants: [currentUser.uid]
    
  });

  currentRoomId = roomId;
  currentRoomRole = "attacker";

  showActiveRoom(roomId);
}

window.createBattleRoom = createBattleRoom;

async function joinBattleRoom() {
  const roomId = document.getElementById("joinRoomId").value.trim().toUpperCase();
  const password = document.getElementById("joinRoomPassword").value.trim();

  if (!roomId) {
    alert("Enter room ID");
    return;
  }

  const roomRef = db.collection("battleRooms").doc(roomId);
  const snap = await roomRef.get();

  if (!snap.exists) {
    alert("Room not found");
    return;
  }

  const room = snap.data();

  if (room.attackerUid === currentUser.uid) {
    alert("You cannot join your own room. Use Add Test Rival for testing.");
    return;
  }

  if (room.password && room.password !== password) {
    alert("Wrong password");
    return;
  }

  if (room.defenderUid) {
    alert("Room already full");
    return;
  }

  await roomRef.update({
  defenderUid: currentUser.uid,
  defenderName: currentData.username,
  status: "active",
  startedAt: Date.now(),
confirmDeadlineAt:
  Date.now() + (Number(room.targetHours) * 60 * 60 * 1000) + (10 * 60 * 1000),
participants: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
});

  currentRoomId = roomId;
  currentRoomRole = "defender";

  showActiveRoom(roomId);
}

window.joinBattleRoom = joinBattleRoom;

function showActiveRoom(roomId) {
  document.getElementById("activeRoomCard").classList.remove("hiddenPage");
  document.getElementById("activeRoomCode").innerText = "WAR ROOM • " + roomId;

  const createCard = document.getElementById("createRoomCard");
  const joinCard = document.getElementById("joinRoomCard");
  if(createCard) createCard.classList.add("hiddenPage");
  if(joinCard) joinCard.classList.add("hiddenPage");

  listenToRoom(roomId);
  document.getElementById("activeRoomCard").scrollIntoView({ behavior: "smooth" });
}

function listenToRoom(roomId) {
  if (roomUnsubscribe) roomUnsubscribe();

  roomUnsubscribe = db.collection("battleRooms").doc(roomId)
    .onSnapshot(function (snap) {
      if (!snap.exists) return;

      const room = snap.data();
      latestRoomData = room;

      document.getElementById("activeRoomTitle").innerText =
        room.attackerName + " vs " + (room.defenderName || "Awaiting Rival");

      document.getElementById("activeRoomTarget").innerText =
        "Target: " + room.targetHours + "h";

      updateBattleStatuses(room);
      startRoomTimer(room);

      if (room.status === "ended" && room.scorecard) {
        showScoreCard(room.scorecard);
      }
    });
}

function startRoomTimer(room) {
  if (roomTimerInterval) clearInterval(roomTimerInterval);

  roomTimerInterval = setInterval(function () {
    updateRoomTimer(room);
  }, 1000);

  updateRoomTimer(room);
}

function updateRoomTimer(room) {
  const timerBox = document.getElementById("activeRoomTimer");
  const confirmBtn = document.getElementById("confirmStudyBtn");

  if (!room.startedAt) {
    timerBox.innerText = "Waiting";
    confirmBtn.classList.add("hiddenPage");
    return;
  }

  if (room.status === "ended") {
    timerBox.innerText = "Ended";
    confirmBtn.classList.add("hiddenPage");
    return;
  }

  const targetMs = room.targetHours * 60 * 60 * 1000;
  const battleEndAt = room.startedAt + targetMs;
  const confirmDeadlineAt =
    room.confirmDeadlineAt || battleEndAt + (10 * 60 * 1000);

  const now = Date.now();

  if (now >= confirmDeadlineAt) {
    autoEndBattleIfDeadlinePassed(room);
    timerBox.innerText = "Deadline Passed";
    confirmBtn.classList.add("hiddenPage");
    return;
  }

  let leftMs = 0;
  let label = "";

  if (now < battleEndAt) {
    leftMs = battleEndAt - now;
    label = "";
  } else {
    leftMs = confirmDeadlineAt - now;
    label = "Confirm ";
  }

  const hours = Math.floor(leftMs / 3600000);
  const minutes = Math.floor((leftMs % 3600000) / 60000);
  const seconds = Math.floor((leftMs % 60000) / 1000);

  timerBox.innerText =
    label +
    String(hours).padStart(2, "0") + ":" +
    String(minutes).padStart(2, "0") + ":" +
    String(seconds).padStart(2, "0");

  const completedHours =
    Math.min(room.targetHours, (now - room.startedAt) / 3600000).toFixed(1);

  document.getElementById("attackerProgress").innerText =
    completedHours + "h";

  document.getElementById("defenderProgress").innerText =
    room.defenderUid ? completedHours + "h" : "0h";

  const myConfirmed =
    currentRoomRole === "attacker"
      ? room.attackerConfirmed
      : room.defenderConfirmed;

  const myLeft =
    currentRoomRole === "attacker"
      ? room.attackerLeft
      : room.defenderLeft;

  if (now >= battleEndAt && !myConfirmed && !myLeft) {
    confirmBtn.classList.remove("hiddenPage");
  } else {
    confirmBtn.classList.add("hiddenPage");
  }
}

function updateBattleStatuses(room) {
  document.getElementById("attackerStatus").innerText =
    getPlayerStatus(room.attackerConfirmed, room.attackerConfirmedAt, room.attackerLeft, room.attackerLeftAt);

  document.getElementById("defenderStatus").innerText =
    room.defenderUid
      ? getPlayerStatus(room.defenderConfirmed, room.defenderConfirmedAt, room.defenderLeft, room.defenderLeftAt)
      : "Awaiting rival";
}

function getPlayerStatus(confirmed, confirmedAt, left, leftAt) {
  if (confirmed) return "Confirmed at " + formatTime(confirmedAt);
  if (left) return "Left at " + formatTime(leftAt);
  return "In battle";
}

async function confirmStudyDone() {
  if (!currentRoomId || !latestRoomData) return;

  const update = {};

  if (currentRoomRole === "attacker") {
    update.attackerConfirmed = true;
    update.attackerConfirmedAt = Date.now();
  } else {
    update.defenderConfirmed = true;
    update.defenderConfirmedAt = Date.now();
  }

  await db.collection("battleRooms").doc(currentRoomId).update(update);
  await tryGenerateScorecard();
}

window.confirmStudyDone = confirmStudyDone;

async function leaveBattleRoom() {
  if (!currentRoomId) return;

  const update = {};

  if (currentRoomRole === "attacker") {
    update.attackerLeft = true;
    update.attackerLeftAt = Date.now();
  } else {
    update.defenderLeft = true;
    update.defenderLeftAt = Date.now();
  }

  await db.collection("battleRooms").doc(currentRoomId).update(update);
  await tryGenerateScorecard();
}

window.leaveBattleRoom = leaveBattleRoom;

async function tryGenerateScorecard() {
  if (!currentRoomId) return;

  const roomRef = db.collection("battleRooms").doc(currentRoomId);
  const snap = await roomRef.get();

  if (!snap.exists) return;

  const room = snap.data();

  if (room.status === "ended") return;

  const attackerDone = room.attackerConfirmed || room.attackerLeft;
  const defenderDone = room.defenderConfirmed || room.defenderLeft;

  if (!attackerDone || !defenderDone) return;

  const scorecard = await buildScorecardWithEffects(room);

  await roomRef.update({
    status: "ended",
    endedAt: Date.now(),
    scorecard
  });
}

function buildScorecard(room) {
  let resultTitle = "";
  let resultLine = "";

  const attackerConfirmed = room.attackerConfirmed === true;
  const defenderConfirmed = room.defenderConfirmed === true;

  if (attackerConfirmed && !defenderConfirmed) {
    resultTitle = "Attack Successful";
    resultLine =
      room.defenderName +
      " failed to confirm before the deadline. Castle integrity was damaged.";
  } else if (!attackerConfirmed && defenderConfirmed) {
    resultTitle = "Defense Successful";
    resultLine =
      room.attackerName +
      " failed to confirm before the deadline. The siege collapsed.";
  } else if (attackerConfirmed && defenderConfirmed) {
    resultTitle = "Castle Defended";
    resultLine =
      "Both warriors confirmed the target. The defender holds the kingdom.";
  } else {
    resultTitle = "War Abandoned";
    resultLine =
      "Neither side confirmed before the deadline. No victory was claimed.";
  }

  return {
    resultTitle,
    resultLine,
    attackerName: room.attackerName,
    defenderName: room.defenderName || "Unknown",
    targetHours: room.targetHours,
    attackerStatus: attackerConfirmed ? "Confirmed" : "Not Confirmed",
    defenderStatus: defenderConfirmed ? "Confirmed" : "Not Confirmed",
    attackerTime: room.attackerConfirmedAt || room.attackerLeftAt,
    defenderTime: room.defenderConfirmedAt || room.defenderLeftAt,
    createdAt: Date.now()
  };
}

function showScoreCard(scorecard) {
  const box = document.getElementById("scoreCardBox");
  box.classList.remove("hiddenPage");

  box.innerHTML = `
    <div class="scoreHeader">
      <div>
        <span>WAR REPORT</span>
        <h3>${scorecard.resultTitle}</h3>
      </div>
      <i class="ri-sword-line"></i>
    </div>

    <div class="scoreDuel">
      <div class="scorePlayer">
        <span>ATTACKER</span>
        <h4>${scorecard.attackerName}</h4>
        <p>${scorecard.attackerStatus}</p>
        <small>${formatTime(scorecard.attackerTime)}</small>
      </div>

      <div class="scoreDivider">VS</div>

      <div class="scorePlayer">
        <span>DEFENDER</span>
        <h4>${scorecard.defenderName}</h4>
        <p>${scorecard.defenderStatus}</p>
        <small>${formatTime(scorecard.defenderTime)}</small>
      </div>
    </div>

    <div class="scoreResult">
  ${scorecard.resultLine}
</div>

<div class="scoreEffects">
  <div>
    <span>Attacker XP</span>
    <b>+${scorecard.attackerXP || 0}</b>
  </div>

  <div>
    <span>Defender XP</span>
    <b>+${scorecard.defenderXP || 0}</b>
  </div>
  <div>
  <span>Attacker Coins</span>
  <b>+${scorecard.attackerCoins || 0}</b>
</div>

<div>
  <span>Defender Coins</span>
  <b>+${scorecard.defenderCoins || 0}</b>
</div>

  <div>
    <span>Castle Damage</span>
    <b>-${scorecard.defenderCastleDamage || 0}%</b>
  </div>

  <div>
    <span>Army Loss</span>
    <b>-${scorecard.attackerArmyLoss || 0}</b>
  </div>
</div>
  `;
}



async function showWarArchives() {
  if (!archivesScreen) {
    alert("Archives screen missing");
    return;
  }

  hideAllScreens();
  clearNav();
  navButtons[1].classList.add("activeNav");
  archivesScreen.style.display = "block";

  const list = document.getElementById("archivesList");

  list.innerHTML = `
    <div class="glassCard archiveEmpty">
      <i class="ri-loader-4-line"></i>
      <h3>Loading Wars</h3>
    </div>
  `;

  try {
    const snapshot = await db.collection("battleRooms")
  .where("participants", "array-contains", currentUser.uid)
  .where("status", "==", "ended")
  .limit(20)
  .get();

    if (snapshot.empty) {
      list.innerHTML = `
        <div class="glassCard archiveEmpty">
          <i class="ri-scroll-to-bottom-line"></i>
          <h3>No Wars Recorded</h3>
          <p>Complete battles to build history.</p>
        </div>
      `;
      return;
    }

    let rooms = [];

    snapshot.forEach(doc => {
      rooms.push(doc.data());
    });

    rooms.sort((a, b) => {
      return (b.endedAt || 0) - (a.endedAt || 0);
    });

    let html = "";

    rooms.forEach(room => {
      if (!room.scorecard) return;

      const s = room.scorecard;

      html += `
        <div class="archiveCard">
          <div class="archiveTop">
            <div>
              <h3>${s.resultTitle}</h3>
              <div class="archiveDate">
                ${room.endedAt ? new Date(room.endedAt).toLocaleDateString() : "--"}
              </div>
            </div>

            <div class="archiveBadge">
              ARCHIVED
            </div>
          </div>

          <div class="archivePlayers">
            <div class="archivePlayer">
              <span>ATTACKER</span>
              <h4>${s.attackerName}</h4>
              <p>${s.attackerStatus}</p>
            </div>

            <div class="archiveVS">VS</div>

            <div class="archivePlayer">
              <span>DEFENDER</span>
              <h4>${s.defenderName}</h4>
              <p>${s.defenderStatus}</p>
            </div>
          </div>

          <div class="archiveBottom">
            ${s.resultLine}
          </div>
        </div>
      `;
    });

    list.innerHTML = html || `
      <div class="glassCard archiveEmpty">
        <h3>No Scorecards Found</h3>
      </div>
    `;

  } catch (error) {
    list.innerHTML = `
      <div class="glassCard archiveEmpty">
        <h3>Archive Error</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

window.toggleMenu = toggleMenu;
window.toggleAccordion = toggleAccordion;
window.showWarArchives = showWarArchives;

function formatTime(ms) {
  if (!ms) return "--";

  const date = new Date(ms);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}
/* FRIEND SYSTEM */

async function updateUsernameSearchKey(){
  if(!currentUser || !currentData) return;

  await db.collection("users").doc(currentUser.uid).set({
    usernameLower: currentData.username.toLowerCase()
  }, { merge:true });
}

async function sendFriendRequest(){
  const input = document.getElementById("friendUsernameInput");
  const msg = document.getElementById("friendMsg");

  const username = input.value.trim();

  msg.innerText = "";

  if(!username){
    msg.innerText = "Enter username";
    return;
  }

  const snap = await db.collection("users")
    .where("usernameLower", "==", username.toLowerCase())
    .limit(1)
    .get();

  if(snap.empty){
    msg.innerText = "User not found";
    return;
  }

  const targetDoc = snap.docs[0];
  const target = targetDoc.data();

  if(target.uid === currentUser.uid){
    msg.innerText = "You cannot add yourself";
    return;
  }

  await db.collection("friendRequests").add({
    fromUid: currentUser.uid,
    fromUsername: currentData.username,
    toUid: target.uid,
    toUsername: target.username,
    status: "pending",
    createdAt: Date.now()
  });

  msg.innerText = "Friend request sent";
  input.value = "";
}

window.sendFriendRequest = sendFriendRequest;

async function loadFriendRequests(){
  const box = document.getElementById("friendRequestsList");
  if(!box || !currentUser) return;

  const snap = await db.collection("friendRequests")
    .where("toUid", "==", currentUser.uid)
    .where("status", "==", "pending")
    .get();

  if(snap.empty){
    box.innerHTML = `<div class="friendItem"><p>No pending requests</p></div>`;
    return;
  }

  let html = "";

  snap.forEach(doc => {
    const r = doc.data();

    html += `
      <div class="friendItem">
        <div class="friendItemTop">
          <div>
            <h4>${escapeHtml(r.fromUsername)}</h4>
            <p>Wants to join your kingdom circle</p>
          </div>

          <button class="friendAction" onclick="acceptFriendRequest('${doc.id}')">
            Accept
          </button>
        </div>
      </div>
    `;
  });

  box.innerHTML = html;
}

async function acceptFriendRequest(requestId){
  const ref = db.collection("friendRequests").doc(requestId);
  const snap = await ref.get();

  if(!snap.exists) return;

  const r = snap.data();

  await db.collection("users").doc(currentUser.uid)
    .collection("friends").doc(r.fromUid).set({
      uid: r.fromUid,
      username: r.fromUsername,
      addedAt: Date.now()
    });

  await db.collection("users").doc(r.fromUid)
    .collection("friends").doc(currentUser.uid).set({
      uid: currentUser.uid,
      username: currentData.username,
      addedAt: Date.now()
    });

  await ref.update({
    status:"accepted",
    acceptedAt:Date.now()
  });

  loadFriendRequests();
  loadFriends();
}

window.acceptFriendRequest = acceptFriendRequest;

async function loadFriends(){
  const box = document.getElementById("friendsList");
  if(!box || !currentUser) return;

  const snap = await db.collection("users")
    .doc(currentUser.uid)
    .collection("friends")
    .get();

  if(snap.empty){
    box.innerHTML = `<div class="friendItem"><p>No friends yet. Add one below.</p></div>`;
    return;
  }

  box.innerHTML = `<div class="friendItem"><p>Loading friends...</p></div>`;

  const friendDocs = snap.docs.map(d => d.data());

  const statuses = await Promise.all(friendDocs.map(f =>
    db.collection("users").doc(f.uid).get().catch(() => null)
  ));

  let html = "";

  friendDocs.forEach((f, i) => {
    const liveSnap = statuses[i];
    const liveData = liveSnap && liveSnap.exists ? liveSnap.data() : null;
    const online = isUserOnline(liveData);

    html += `
      <div class="friendItem" onclick="openFriendProfile('${f.uid}')">
        <div class="friendItemTop">
          <div>
            <h4>
              <span class="friendOnlineDot ${online ? "online" : "offline"}"></span>
              ${escapeHtml(f.username)}
            </h4>
            <p>${online ? "Online now" : "Offline"}</p>
          </div>

<button class="friendAction" onclick="event.stopPropagation(); inviteFriendToBattle('${f.uid}', '${escapeHtml(f.username).replace(/'/g, "\\'")}')">
  Invite
</button>
        </div>
      </div>
    `;
  });

  box.innerHTML = html;
}

async function loadFriendSystem(){
  await updateUsernameSearchKey();

  try{
    await loadFriendRequests();
  }catch(e){
    console.log("Friend requests error:", e);
  }

  try{
    await loadBattleInvites();
  }catch(e){
    console.log("Battle invites error:", e);

    const box = document.getElementById("battleInvitesList");
    if(box){
      box.innerHTML = `<div class="friendItem"><p>No battle invites</p></div>`;
    }
  }

  try{
    await loadFriends();
  }catch(e){
    console.log("Friends error:", e);
  }

  updateProfileNavBadge();
}

async function updateProfileNavBadge(){
  const badge = document.getElementById("profileNavBadge");
  if(!badge || !currentUser) return;

  try{
    const requestsSnap = await db.collection("friendRequests")
      .where("toUid", "==", currentUser.uid)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    const invitesSnap = await db.collection("battleInvites")
      .where("toUid", "==", currentUser.uid)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    const hasPending = !requestsSnap.empty || !invitesSnap.empty;
    badge.classList.toggle("hidden", !hasPending);
  }catch(e){
    badge.classList.add("hidden");
  }
}
function logout() {
  goOffline();
  stopPresence();
  stopBattleInviteListener();

  resetBattleUI();

  emailInput.value = "";
  passwordInput.value = "";
  usernameInput.value = "";
  authMsg.innerText = "";

  auth.signOut();
}

window.logout = logout;
function resetBattleUI(){
  currentRoomId = null;
  currentRoomRole = null;
  latestRoomData = null;

  if(roomUnsubscribe){
    roomUnsubscribe();
    roomUnsubscribe = null;
  }

  if(roomTimerInterval){
    clearInterval(roomTimerInterval);
    roomTimerInterval = null;
  }

  const activeRoomCard = document.getElementById("activeRoomCard");
  if(activeRoomCard){
    activeRoomCard.classList.add("hiddenPage");
  }

  const scoreCardBox = document.getElementById("scoreCardBox");
  if(scoreCardBox){
    scoreCardBox.classList.add("hiddenPage");
  }

  const createCard = document.getElementById("createRoomCard");
  const joinCard = document.getElementById("joinRoomCard");
  if(createCard) createCard.classList.remove("hiddenPage");
  if(joinCard) joinCard.classList.remove("hiddenPage");

  const fields = [
    "battleTargetHours",
    "battlePassword",
    "joinRoomId",
    "joinRoomPassword"
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = "";
  });

  const activeRoomTitle = document.getElementById("activeRoomTitle");
  if(activeRoomTitle) activeRoomTitle.innerText = "Kingdom War";

  const activeRoomCode = document.getElementById("activeRoomCode");
  if(activeRoomCode) activeRoomCode.innerText = "WAR ROOM";

  const activeRoomTimer = document.getElementById("activeRoomTimer");
  if(activeRoomTimer) activeRoomTimer.innerText = "Waiting";

  const attackerProgress = document.getElementById("attackerProgress");
  if(attackerProgress) attackerProgress.innerText = "0h";

  const defenderProgress = document.getElementById("defenderProgress");
  if(defenderProgress) defenderProgress.innerText = "0h";

  const attackerStatus = document.getElementById("attackerStatus");
  if(attackerStatus) attackerStatus.innerText = "Waiting";

  const defenderStatus = document.getElementById("defenderStatus");
  if(defenderStatus) defenderStatus.innerText = "Waiting";
}
async function loadActiveBattleRoom(){
  if(!currentUser) return;

  const snap = await db.collection("battleRooms")
    .where("participants", "array-contains", currentUser.uid)
    .where("status", "in", ["waiting", "active"])
    .limit(1)
    .get();

  if(snap.empty) return;

  const roomDoc = snap.docs[0];
  const room = roomDoc.data();

  currentRoomId = room.roomId;

  if(room.attackerUid === currentUser.uid){
    currentRoomRole = "attacker";
  } else if(room.defenderUid === currentUser.uid){
    currentRoomRole = "defender";
  }

  showActiveRoom(currentRoomId);
}
let selectedInviteFriend = null;

function inviteFriendToBattle(friendUid, friendUsername){
  selectedInviteFriend = {
    uid: friendUid,
    username: friendUsername
  };

  document.getElementById("inviteFriendName").innerText =
    "Invite " + friendUsername;

  document.getElementById("inviteTargetHours").value = "";

  document.getElementById("inviteModal").classList.remove("hiddenPage");

  const dock = document.getElementById("bottomNav");
  if (dock) dock.style.display = "none";
}

window.inviteFriendToBattle = inviteFriendToBattle;

function closeInviteModal(){
  document.getElementById("inviteModal").classList.add("hiddenPage");

  const dock = document.getElementById("bottomNav");
  if (dock) dock.style.display = "";
}

window.closeInviteModal = closeInviteModal;

async function sendBattleInviteFromModal(){

  const targetHours = Number(
    document.getElementById("inviteTargetHours").value
  );

  if(!selectedInviteFriend){
    alert("No friend selected");
    return;
  }

  if(!targetHours || targetHours <= 0){
    alert("Enter valid target hours");
    return;
  }

  try{

    await db.collection("battleInvites").add({
      fromUid: currentUser.uid,
      fromUsername: currentData.username,
      toUid: selectedInviteFriend.uid,
      toUsername: selectedInviteFriend.username,
      targetHours: targetHours,
      status: "pending",
      createdAt: Date.now()
    });

    const status = document.getElementById("inviteStatus");

status.innerText = "Battle invite sent";
status.classList.add("success");

setTimeout(function(){
  closeInviteModal();
  status.innerText = "";
  status.classList.remove("success");
}, 900);

  }catch(error){

    alert(error.message);

  }
}

window.sendBattleInviteFromModal = sendBattleInviteFromModal;
async function loadBattleInvites(){
  const box = document.getElementById("battleInvitesList");
  if(!box || !currentUser) return;

  const snap = await db.collection("battleInvites")
    .where("toUid", "==", currentUser.uid)
    .where("status", "==", "pending")
    .get();

  if(snap.empty){
    box.innerHTML = `<div class="friendItem"><p>No battle invites</p></div>`;
    return;
  }

  let html = "";

  snap.forEach(doc => {
    const invite = doc.data();
    const rewards = calculateBattleRewards(invite.targetHours);

    html += `
      <div class="friendItem">
        <div>
          <h4>${escapeHtml(invite.fromUsername)}</h4>
          <p>Target: ${invite.targetHours}h battle &middot; Reward: +${rewards.xp} XP, +${rewards.coins} coins</p>
        </div>

        <div class="friendInviteActions">
          <button class="friendAction" onclick="acceptBattleInvite('${doc.id}')">
            Accept
          </button>

          <button class="declineAction" onclick="declineBattleInvite('${doc.id}')">
            Decline
          </button>
        </div>
      </div>
    `;
  });

  box.innerHTML = html;
}

/* ── Live battle-invite popup (real-time notification) ─ */
let battleInviteUnsub = null;
let battleInviteSessionStart = 0;

function startBattleInviteListener(){
  if (!currentUser) return;
  if (battleInviteUnsub) { battleInviteUnsub(); battleInviteUnsub = null; }

  battleInviteSessionStart = Date.now();

  battleInviteUnsub = db.collection("battleInvites")
    .where("toUid", "==", currentUser.uid)
    .where("status", "==", "pending")
    .onSnapshot(function(snap){
      snap.docChanges().forEach(function(change){
        if (change.type === "added") {
          const invite = change.doc.data();
          if (invite.createdAt && invite.createdAt >= battleInviteSessionStart - 4000) {
            showBattleInvitePopup(change.doc.id, invite);
          }
        }
      });

      loadBattleInvites();
      updateProfileNavBadge();
    }, function(err){
      console.log("Battle invite listener error:", err);
    });
}

function stopBattleInviteListener(){
  if (battleInviteUnsub) {
    battleInviteUnsub();
    battleInviteUnsub = null;
  }
}

function showBattleInvitePopup(inviteId, invite){
  if (document.querySelector('.battleInvitePopup[data-invite-id="' + inviteId + '"]')) return;

  const rewards = calculateBattleRewards(invite.targetHours);

  const box = document.createElement("div");
  box.className = "battleInvitePopup";
  box.setAttribute("data-invite-id", inviteId);

  box.innerHTML = `
    <div class="battleInvitePopupIcon"><i class="ri-sword-line"></i></div>
    <div class="battleInvitePopupBody">
      <span>BATTLE INVITE</span>
      <h4>${escapeHtml(invite.fromUsername)} challenges you!</h4>
      <p>Target <b>${invite.targetHours}h</b> focus &middot; Reward <b>+${rewards.xp} XP</b>, <b>+${rewards.coins} coins</b></p>
      <div class="battleInvitePopupActions">
        <button class="friendAction" onclick="acceptBattleInviteFromPopup('${inviteId}', this)">Accept</button>
        <button class="declineAction" onclick="declineBattleInviteFromPopup('${inviteId}', this)">Decline</button>
      </div>
    </div>
  `;

  document.body.appendChild(box);
  if (window.SFX) SFX.tap();

  setTimeout(function(){
    if (box.isConnected) box.remove();
  }, 25000);
}

function acceptBattleInviteFromPopup(inviteId, btn){
  const popup = btn.closest(".battleInvitePopup");
  if (popup) popup.remove();
  acceptBattleInvite(inviteId);
}

function declineBattleInviteFromPopup(inviteId, btn){
  const popup = btn.closest(".battleInvitePopup");
  if (popup) popup.remove();
  declineBattleInvite(inviteId);
}

window.acceptBattleInviteFromPopup = acceptBattleInviteFromPopup;
window.declineBattleInviteFromPopup = declineBattleInviteFromPopup;



async function declineBattleInvite(inviteId){
  await db.collection("battleInvites").doc(inviteId).update({
    status: "declined",
    declinedAt: Date.now()
  });

  loadBattleInvites();
}

window.declineBattleInvite = declineBattleInvite;
async function acceptBattleInvite(inviteId){
  const ref = db.collection("battleInvites").doc(inviteId);
  const snap = await ref.get();

  if(!snap.exists){
    alert("Invite not found");
    return;
  }

  const invite = snap.data();

  if(invite.status !== "pending"){
    alert("Invite already handled");
    return;
  }

  const roomId = generateRoomId();

  await db.collection("battleRooms").doc(roomId).set({
    roomId: roomId,
    targetHours: invite.targetHours,
    password: "",
    status: "active",

    attackerUid: invite.fromUid,
    attackerName: invite.fromUsername,
    attackerConfirmed: false,
    attackerConfirmedAt: null,
    attackerLeft: false,
    attackerLeftAt: null,

    defenderUid: currentUser.uid,
    defenderName: currentData.username,
    defenderConfirmed: false,
    defenderConfirmedAt: null,
    defenderLeft: false,
    defenderLeftAt: null,

    participants: [invite.fromUid, currentUser.uid],

    createdAt: Date.now(),
    startedAt: Date.now(),
    endedAt: null,
    scorecard: null
  });

  await ref.update({
    status: "accepted",
    acceptedAt: Date.now(),
    roomId: roomId
  });

  currentRoomId = roomId;
  currentRoomRole = "defender";

  showBattleScreen();
  showActiveRoom(roomId);
}

window.acceptBattleInvite = acceptBattleInvite;

async function declineBattleInvite(inviteId){
  await db.collection("battleInvites").doc(inviteId).update({
    status: "declined",
    declinedAt: Date.now()
  });

  await loadBattleInvites();
}

window.declineBattleInvite = declineBattleInvite;
async function autoEndBattleIfDeadlinePassed(room){
  if (!currentRoomId) return;
  if (room.status === "ended") return;

  const now = Date.now();

  const targetMs = room.targetHours * 60 * 60 * 1000;
  const battleEndAt = room.startedAt + targetMs;
  const confirmDeadlineAt =
    room.confirmDeadlineAt || battleEndAt + (10 * 60 * 1000);

  if (now < confirmDeadlineAt) return;

  const roomRef =
    db.collection("battleRooms").doc(currentRoomId);

  const freshSnap = await roomRef.get();

  if (!freshSnap.exists) return;

  const freshRoom = freshSnap.data();

  if (freshRoom.status === "ended") return;

  const scorecard = await buildScorecardWithEffects(freshRoom);

  await roomRef.update({
    status: "ended",
    endedAt: Date.now(),
    scorecard: scorecard
  });
}
let selectedProfileFriend = null;

async function openFriendProfile(friendUid){
  const snap = await db.collection("users").doc(friendUid).get();

  if(!snap.exists){
    alert("Friend profile not found");
    return;
  }

  const data = snap.data();

  selectedProfileFriend = {
    uid: friendUid,
    username: data.username
  };

  document.getElementById("friendProfileName").innerText =
    data.username || "Friend";

  document.getElementById("friendProfileLevel").innerText =
    data.level || 1;

  document.getElementById("friendProfileStudy").innerText =
    formatStudyTime(data.totalStudyMinutes || 0);

  document.getElementById("friendProfileCastle").innerText =
    (data.castleHealth || 100) + "%";

  document.getElementById("friendProfileArmy").innerText =
    data.armyPower || 0;

  document.getElementById("friendProfileInviteBtn").onclick = function(){
    closeFriendProfile();

    inviteFriendToBattle(
      selectedProfileFriend.uid,
      selectedProfileFriend.username
    );
  };

  document.getElementById("friendProfileModal")
    .classList.remove("hiddenPage");

  const dock = document.getElementById("bottomNav");
  if (dock) dock.style.display = "none";
}

window.openFriendProfile = openFriendProfile;

function closeFriendProfile(){
  document.getElementById("friendProfileModal")
    .classList.add("hiddenPage");

  const dock = document.getElementById("bottomNav");
  if (dock) dock.style.display = "";
}

window.closeFriendProfile = closeFriendProfile;
function showSessionComplete(){
  const box = document.createElement("div");

  box.className = "sessionToast";
  box.innerHTML = `
    <div>
      <span>SESSION COMPLETE</span>
      <h3>Focus reward added</h3>
      <p>Your XP, coins, and study progress are updated.</p>

      <button class="primaryBtn" onclick="finishSessionToast(this)">
        Continue
      </button>
    </div>
  `;

  document.body.appendChild(box);
}

function finishSessionToast(button){
  const box = button.closest(".sessionToast");
  if(box) box.remove();

  closeTimer();
}

window.finishSessionToast = finishSessionToast;
async function quitSoloSession(){
  if(!timerRunning) return;

  clearInterval(timerInterval);
  timerRunning = false;

  const deadTrees = (currentData.deadTrees || 0) + 1;

const oldForestTrees =
    currentData.forestTrees || [];

  let updatedForestTrees = oldForestTrees;

  if(oldForestTrees.length < forestSpots.length){
    const spot = forestSpots[oldForestTrees.length];

    updatedForestTrees = [
      ...oldForestTrees,
      {
        id: Date.now().toString(),
        type: "dead",
        x: spot.x,
        y: spot.y,
        minutes: 0,
        createdAt: Date.now()
      }
    ];
  }

  await db.collection("users").doc(currentUser.uid).update({
    deadTrees: deadTrees,
    forestTrees: updatedForestTrees
  });

  await loadUserData();

  timerSeconds = selectedMinutes * 60;
  updateTimerDisplay();
  restoreTimerUI();

  document.getElementById("startTimerBtn").classList.remove("hiddenPage");
  document.getElementById("quitSoloBtn").classList.add("hiddenPage");

  showSessionFailed();
}

window.quitSoloSession = quitSoloSession;
function showSessionFailed(){
  const box = document.createElement("div");

  box.className = "sessionToast";
  box.innerHTML = `
    <div>
      <span>SESSION FAILED</span>
      <h3>Dead tree added</h3>
      <p>No XP or coins were earned because the session was left early.</p>

      <button class="primaryBtn" onclick="this.closest('.sessionToast').remove()">
        Continue
      </button>
    </div>
  `;

  document.body.appendChild(box);
}

function calculateLevel(totalXP){
  return Math.floor(Math.sqrt(totalXP / 50)) + 1;
}
function getXPRequired(level){
  return level * level * 50;
}
function getXPForSession(minutes){
  return Math.round(minutes);
}
function getTodayDateString(){

  const now = new Date();

  return (
    now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2,"0") + "-" +
    String(now.getDate()).padStart(2,"0")
  );
}
async function buildScorecardWithEffects(room){

  const scorecard = buildScorecard(room);

  if(!room.attackerUid || !room.defenderUid){
    return scorecard;
  }

  const attackerRef = db.collection("users").doc(room.attackerUid);

  const defenderRef = db.collection("users").doc(room.defenderUid);

  const attackerSnap = await attackerRef.get();
  const defenderSnap = await defenderRef.get();

  if(!attackerSnap.exists || !defenderSnap.exists){
    return scorecard;
  }

  const attacker = attackerSnap.data();
  const defender = defenderSnap.data();

  const targetMinutes = Math.round((room.targetHours || 0) * 60);

const battleRewards = calculateBattleRewards(room.targetHours);
const isRewardEligible = targetMinutes >= 15;
const winBonusXP = isRewardEligible ? 100 : 0;
const winBonusCoins = isRewardEligible ? 100 : 0;

  let attackerXP = 0;
  let defenderXP = 0;
  let attackerCoins = 0;
  let defenderCoins = 0;

  let attackerArmyLoss = 0;
  let defenderCastleDamage = 0;

  const attackerConfirmed = room.attackerConfirmed === true;
  const defenderConfirmed = room.defenderConfirmed === true;

  const attackerPower = attacker.armyPower || 0;
  const defenderDefense = defender.castleDefense || 100;

  let damage = Math.round((attackerPower - defenderDefense) / 5);

  if(damage < 5) damage = 5;
  if(damage > 35) damage = 35;

  if(attackerConfirmed && !defenderConfirmed){
    attackerXP = battleRewards.xp;
attackerCoins = battleRewards.coins;

    defenderCastleDamage = damage;

    await attackerRef.update({
      totalXP: (attacker.totalXP || 0) + attackerXP,
      coins: (attacker.coins || 0) + attackerCoins,
      level: calculateLevel((attacker.totalXP || 0) + attackerXP)
    });

    await defenderRef.update({
      castleHealth: Math.max(0, (defender.castleHealth || 100) - defenderCastleDamage)
    });
  }

  else if(!attackerConfirmed && defenderConfirmed){
    defenderXP = battleRewards.xp;
defenderCoins = battleRewards.coins;

    attackerArmyLoss = 10;

    await defenderRef.update({
      totalXP: (defender.totalXP || 0) + defenderXP,
      coins: (defender.coins || 0) + defenderCoins,
      level: calculateLevel((defender.totalXP || 0) + defenderXP)
    });

    await attackerRef.update({
      armyPower: Math.max(0, (attacker.armyPower || 0) - attackerArmyLoss)
    });
  }

  else if(attackerConfirmed && defenderConfirmed){
    attackerXP = Math.floor(battleRewards.xp * 0.8);
defenderXP = battleRewards.xp;

attackerCoins = Math.floor(battleRewards.coins * 0.8);
defenderCoins = battleRewards.coins;

    attackerArmyLoss = 5;

    await attackerRef.update({
      totalXP: (attacker.totalXP || 0) + attackerXP,
      coins: (attacker.coins || 0) + attackerCoins,
      armyPower: Math.max(0, (attacker.armyPower || 0) - attackerArmyLoss),
      level: calculateLevel((attacker.totalXP || 0) + attackerXP)
    });

    await defenderRef.update({
      totalXP: (defender.totalXP || 0) + defenderXP,
      coins: (defender.coins || 0) + defenderCoins,
      level: calculateLevel((defender.totalXP || 0) + defenderXP)
    });
  }

  scorecard.attackerXP = attackerXP;
  scorecard.defenderXP = defenderXP;
  scorecard.attackerCoins = attackerCoins;
  scorecard.defenderCoins = defenderCoins;
  scorecard.attackerArmyLoss = attackerArmyLoss;
  scorecard.defenderCastleDamage = defenderCastleDamage;

  return scorecard;
}
function getArmyUpgradeCost(){
  const armyPower = currentData.armyPower || 0;
  const upgradeLevel = Math.floor(armyPower / 10);
  return 100 + (upgradeLevel * 50);
}

function getDefenseUpgradeCost(){
  const defense = currentData.castleDefense || 100;
  const upgradeLevel = Math.floor((defense - 100) / 5);
  return 120 + (upgradeLevel * 60);
}

async function upgradeArmy(){
  const cost = getArmyUpgradeCost();

  if((currentData.coins || 0) < cost){
    showToast("Not enough coins");
    return;
  }

  await db.collection("users").doc(currentUser.uid).update({
    coins: (currentData.coins || 0) - cost,
    armyPower: (currentData.armyPower || 0) + 10
  });

  await loadUserData();

  showToast("Army upgraded");
}

window.upgradeArmy = upgradeArmy;

async function upgradeDefense(){
  const cost = getDefenseUpgradeCost();

  if((currentData.coins || 0) < cost){
    showToast("Not enough coins");
    return;
  }

  await db.collection("users").doc(currentUser.uid).update({
    coins: (currentData.coins || 0) - cost,
    castleDefense: (currentData.castleDefense || 100) + 5,
    castleHealth: Math.min(100, (currentData.castleHealth || 100) + 10)
  });

  await loadUserData();

  showToast("Castle defense upgraded");
}

window.upgradeDefense = upgradeDefense;
function showToast(text){
  const toast = document.getElementById("toast");

  if(!toast){
    console.log("Toast missing");
    return;
  }

  toast.innerText = text;
  toast.classList.add("show");

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(function(){
    toast.classList.remove("show");
  }, 2200);
}

window.showToast = showToast;
function getStreakBonusPercent(){

  const streak = currentData?.streak || 0;

  if(streak >= 30) return 25;
  if(streak >= 15) return 15;
  if(streak >= 7) return 10;
  if(streak >= 3) return 5;

  return 0;
}

function getMotivationLine(){

  const streak = currentData?.streak || 0;

  if(streak >= 30){
    return "Legendary consistency ✨";
  }

  if(streak >= 15){
    return "Your kingdom fears no distraction ⚔️";
  }

  if(streak >= 7){
    return "Focus is becoming your identity 🔥";
  }

  if(streak >= 3){
    return "Momentum is building 🌿";
  }

  return "Small focus creates giant kingdoms ⚔️";
}

function updateSessionPreview(){

  const mins = selectedMinutes;

  let xp =
    getXPForSession(mins);

  let coins =
    Math.floor(mins * 1.5);

  let tree = "Seed";

  if(mins >= 30){
    tree = "Young Tree";
  }

  if(mins >= 60){
    tree = "Full Tree";
  }

  if(mins >= 120){
    tree = "Rare Tree";
  }

  const streakBonus =
    getStreakBonusPercent();

  xp += Math.floor(
    xp * (streakBonus / 100)
  );

  document.getElementById("previewXP").innerText =
    xp + " XP";

  document.getElementById("previewCoins").innerText =
    coins;

  document.getElementById("previewTree").innerText =
    tree;

  document.getElementById("previewStreak").innerText =
    "+" + streakBonus + "%";

  document.getElementById("motivationLine").innerText =
    getMotivationLine();
}

function calculateBattleRewards(hours){

  const mins = Number(hours) * 60;

  if(mins < 15){
    return {
      xp: 0,
      coins: 0
    };
  }

  let xp = Math.floor(mins * 1.8);
  let coins = Math.floor(mins * 0.9);

  if(mins >= 120){
    xp += 80;
    coins += 40;
  }

  return {
    xp,
    coins
  };
}
function restoreTimerUI() {
  const subjectWrap = document.getElementById("subjectWrap");
  const timeGrid    = document.getElementById("timeGrid");
  const customBtn   = document.getElementById("customToggleBtn");
  const subjectInp  = document.getElementById("subjectInput");
  if (subjectWrap) subjectWrap.style.display = "";
  if (timeGrid)  { timeGrid.style.opacity = ""; timeGrid.style.pointerEvents = ""; }
  if (customBtn)   customBtn.style.display = "";
  if (subjectInp)  subjectInp.value = "";
  resetCustomInput();
}

let rewardSlideIndex = 0;
const REWARD_TOTAL = 4;

function goRewardSlide(idx) {
  rewardSlideIndex = Math.max(0, Math.min(REWARD_TOTAL - 1, idx));
  const track = document.getElementById("rewardTrack");
  if (track) track.style.transform = "translateX(-" + (rewardSlideIndex * 25) + "%)";
  document.querySelectorAll(".rdot").forEach(function(d, i) {
    d.classList.toggle("active", i === rewardSlideIndex);
  });
}

window.goRewardSlide = goRewardSlide;

function initRewardCarouselSwipe() {
  const carousel = document.getElementById("rewardCarousel");
  if (!carousel || carousel._swipeInit) return;
  carousel._swipeInit = true;
  let startX = 0, startY = 0, moved = false;
  carousel.addEventListener("touchstart", function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved = false;
  }, { passive: true });
  carousel.addEventListener("touchend", function(e) {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35) {
      if (dx < 0) goRewardSlide(rewardSlideIndex + 1);
      else         goRewardSlide(rewardSlideIndex - 1);
      if (window.SFX) SFX.tap();
    }
  }, { passive: true });
}

function showRewardModal(data){
  if (window.SFX) SFX.success();
  const rCard = document.querySelector('.rewardCard');
  if (rCard && window.Animations) Animations.revealModal(rCard);

  const minutesEl = document.getElementById("rewardMinutes");
  const xpEl      = document.getElementById("rewardXP");
  const coinsEl   = document.getElementById("rewardCoins");
  const streakEl  = document.getElementById("rewardStreak");
  const treeEl    = document.getElementById("rewardTree");

  if (minutesEl) minutesEl.innerText = data.minutes + " min";
  if (xpEl)      xpEl.innerText      = "+" + data.xp;
  if (coinsEl)   coinsEl.innerText   = "+" + data.coins;
  if (streakEl)  streakEl.innerText  = "+" + data.streakBonus + "%";
  if (treeEl)    treeEl.innerText    = data.tree ? "🌱 " + data.tree + " tree earned" : "Keep going!";

  goRewardSlide(0);
  initRewardCarouselSwipe();

  document.getElementById("rewardModal")
    .classList.remove("hiddenPage");

  const dock = document.getElementById("bottomNav");
  if (dock) dock.style.display = "none";
}

function closeRewardModal(){
  document.getElementById("rewardModal")
    .classList.add("hiddenPage");

  const dock = document.getElementById("bottomNav");
  if (dock) dock.style.display = "";

  closeTimer();
}

window.closeRewardModal = closeRewardModal;

const TREE_ASSETS = {
  seed:      "Free/TreesAndBrushes/Brush1a.png",
  young:     "Free/TreesAndBrushes/Brush2a.png",
  full:      "Free/TreesAndBrushes/Tree1a.png",
  rare:      "Free/TreesAndBrushes/Tree2a.png",
  legendary: "Free/TreesAndBrushes/Tree2b.png",
  dead:      "Free/TreesAndBrushes/Stump.png"
};

const forestSpots = [
  {x:220,y:560},{x:310,y:610},{x:420,y:535},{x:520,y:630},{x:640,y:555},
  {x:760,y:620},{x:880,y:545},{x:1010,y:640},{x:1120,y:560},{x:1240,y:630},
  {x:1360,y:545},{x:1490,y:620},{x:1610,y:555},{x:1720,y:635},

  {x:260,y:720},{x:370,y:780},{x:480,y:700},{x:590,y:790},{x:720,y:710},
  {x:830,y:805},{x:950,y:725},{x:1070,y:800},{x:1180,y:710},{x:1300,y:790},
  {x:1420,y:720},{x:1540,y:800},{x:1660,y:720},

  {x:210,y:880},{x:330,y:950},{x:450,y:870},{x:570,y:960},{x:690,y:880},
  {x:810,y:950},{x:930,y:870},{x:1050,y:960},{x:1170,y:880},{x:1290,y:950},
  {x:1410,y:870},{x:1530,y:960},{x:1650,y:880},

  {x:250,y:1060},{x:380,y:1130},{x:510,y:1040},{x:640,y:1140},{x:770,y:1060},
  {x:900,y:1130},{x:1030,y:1040},{x:1160,y:1140},{x:1290,y:1060},{x:1420,y:1130},
  {x:1550,y:1040},{x:1680,y:1140},

  {x:300,y:1240},{x:430,y:1320},{x:560,y:1220},{x:690,y:1330},{x:820,y:1240},
  {x:950,y:1320},{x:1080,y:1220},{x:1210,y:1330},{x:1340,y:1240},{x:1470,y:1320},
  {x:1600,y:1220},

  {x:240,y:1450},{x:390,y:1510},{x:540,y:1430},{x:690,y:1530},{x:840,y:1450},
  {x:990,y:1510},{x:1140,y:1430},{x:1290,y:1530},{x:1440,y:1450},{x:1590,y:1510},

  {x:260,y:1650},{x:430,y:1700},{x:600,y:1620},{x:770,y:1720},{x:940,y:1650},
  {x:1110,y:1700},{x:1280,y:1620},{x:1450,y:1720},{x:1620,y:1650},

  {x:350,y:1850},{x:520,y:1930},{x:690,y:1840},{x:860,y:1940},{x:1030,y:1850},
  {x:1200,y:1930},{x:1370,y:1840},{x:1540,y:1940},

  {x:280,y:2080},{x:470,y:2160},{x:660,y:2070},{x:850,y:2170},{x:1040,y:2080},
  {x:1230,y:2160},{x:1420,y:2070},{x:1610,y:2170},

  {x:360,y:2320},{x:570,y:2410},{x:780,y:2310},{x:990,y:2420},{x:1200,y:2320},
  {x:1410,y:2410},{x:1620,y:2320}
];

function getTreeTypeFromMinutes(minutes){
  if(minutes >= 300) return "legendary";
  if(minutes >= 120) return "rare";
  if(minutes >= 60) return "full";
  if(minutes >= 30) return "young";
  if(minutes >= 15) return "seed";
  return null;
}

function getUserForestTrees(){
  return currentData?.forestTrees || [];
}

async function addTreeToForest(type, minutes){
  if(!currentUser || !type) return;

  const oldTrees = getUserForestTrees();

  if(oldTrees.length >= forestSpots.length){
    showToast("Forest zone full. New zone needed soon.");
    return;
  }

  const spot = forestSpots[oldTrees.length];

  const newTree = {
    id: Date.now().toString(),
    type: type,
    x: spot.x,
    y: spot.y,
    minutes: minutes || 0,
    createdAt: Date.now()
  };

  const updatedTrees = [
    ...oldTrees,
    newTree
  ];

  await db.collection("users").doc(currentUser.uid).update({
    forestTrees: updatedTrees
  });

  currentData.forestTrees = updatedTrees;
  renderForestTrees();
}

function renderForestTrees(){
  const layer = document.getElementById("treeLayer");
  if(!layer || !currentData) return;

  const savedTrees = currentData.forestTrees || [];
  const trees = [];

  const livingCount = currentData.trees || 0;
  const deadCount = currentData.deadTrees || 0;

  const naturalSpots = [
    {x:28,y:76},{x:40,y:72},{x:53,y:75},{x:66,y:72},{x:78,y:76},
    {x:32,y:82},{x:46,y:85},{x:60,y:82},{x:73,y:86},{x:84,y:82},
    {x:26,y:90},{x:39,y:92},{x:52,y:90},{x:65,y:93},{x:79,y:90},
    {x:34,y:67},{x:48,y:64},{x:62,y:66},{x:75,y:64},{x:86,y:68}
  ];

  for(let i = 0; i < livingCount; i++){
    const spot = naturalSpots[i % naturalSpots.length];
    trees.push({
      id:"old-living-" + i,
      type:"full",
      xPercent:spot.x,
      yPercent:spot.y,
      minutes:60,
      createdAt:currentData.createdAt || Date.now()
    });
  }

  for(let i = 0; i < deadCount; i++){
    const spot = naturalSpots[(livingCount + i) % naturalSpots.length];
    trees.push({
      id:"old-dead-" + i,
      type:"dead",
      xPercent:spot.x,
      yPercent:spot.y,
      minutes:0,
      createdAt:currentData.createdAt || Date.now()
    });
  }

  savedTrees.forEach((tree, i) => {
    const spot = naturalSpots[(trees.length + i) % naturalSpots.length];
    trees.push({
      ...tree,
      xPercent:spot.x,
      yPercent:spot.y
    });
  });

  layer.innerHTML = "";

  trees.forEach(tree => {
    const img = document.createElement("img");

    img.src = TREE_ASSETS[tree.type] || TREE_ASSETS.seed;
    img.className = "mapTree " + tree.type;

    img.style.left = tree.xPercent + "%";
    img.style.top = tree.yPercent + "%";

    img.onclick = function(){
      showTreeInfo(tree);
    };

    layer.appendChild(img);
  });
}

function showTreeInfo(tree){
  const date = new Date(tree.createdAt || Date.now());

  const dateText = date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const typeName =
    tree.type.charAt(0).toUpperCase() + tree.type.slice(1);

  showToast(
    typeName +
    " Tree • " +
    (tree.minutes || 0) +
    " min • " +
    dateText
  );
}

let pixelPlayerX = 680;
let pixelPlayerY = 700;

async function openPixelForest(){
  // Pixel Forest mini-game is temporarily disabled — coming soon.
  // (Game world, joystick, and rendering logic below are no longer triggered.)
  showToast("Pixel Forest is coming soon!");
}

function renderPixelWorldTrees(){
  const layer = document.getElementById("pixelTreeLayer");
  if(!layer) return;

  layer.innerHTML = "";

  const savedTrees = (currentData && currentData.forestTrees) ? currentData.forestTrees : [];

  savedTrees.forEach(function(tree, i){
    if(i >= forestSpots.length) return;
    const spot = forestSpots[i];
    if(spot.x > WORLD_W - 50 || spot.y > WORLD_H - 50) return;

    const img = document.createElement("img");
    img.src = TREE_ASSETS[tree.type] || TREE_ASSETS.seed;
    img.className = "pixelWorldTree " + tree.type;
    img.style.left = spot.x + "px";
    img.style.top  = spot.y + "px";
    img.dataset.treeIndex = i;
    img.onclick = function(){ interactPixelWorld(); };
    layer.appendChild(img);
  });
}

function updatePlayerDirection(dx, dy){
  const player = document.getElementById("pixelPlayer");
  if(!player) return;

  if(Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05){
    player.classList.add("walking");
  } else {
    player.classList.remove("walking");
  }

  if(dx < -0.1){
    player.classList.add("facingLeft");
    player.classList.remove("facingRight");
  } else if(dx > 0.1){
    player.classList.add("facingRight");
    player.classList.remove("facingLeft");
  }
}

const FLOWER_SPOTS = [
  {x:90,y:180,c:"Red",v:1},{x:220,y:340,c:"Blue",v:2},{x:380,y:150,c:"Yellow",v:1},
  {x:150,y:520,c:"Purple",v:3},{x:480,y:280,c:"Red",v:2},{x:620,y:460,c:"Blue",v:1},
  {x:780,y:200,c:"Yellow",v:3},{x:900,y:380,c:"Purple",v:2},{x:340,y:680,c:"Red",v:3},
  {x:560,y:750,c:"Blue",v:1},{x:740,y:620,c:"Yellow",v:2},{x:980,y:540,c:"Purple",v:1},
  {x:1350,y:120,c:"Red",v:1},{x:1480,y:280,c:"Blue",v:2},{x:1680,y:160,c:"Yellow",v:3},
  {x:1820,y:340,c:"Purple",v:1},{x:1960,y:180,c:"Red",v:2},{x:2100,y:290,c:"Blue",v:1},
  {x:2250,y:140,c:"Yellow",v:3},{x:2380,y:340,c:"Purple",v:2},
  {x:180,y:1100,c:"Red",v:1},{x:380,y:1280,c:"Blue",v:2},{x:640,y:1180,c:"Yellow",v:1},
  {x:880,y:1380,c:"Purple",v:3},{x:1300,y:1100,c:"Red",v:2},{x:1400,y:1350,c:"Blue",v:1},
  {x:1700,y:1480,c:"Yellow",v:3},{x:1900,y:1380,c:"Purple",v:2},
  {x:2100,y:1250,c:"Red",v:1},{x:2300,y:1450,c:"Blue",v:3},
  {x:2150,y:820,c:"Yellow",v:2},{x:60,y:900,c:"Purple",v:1},
  {x:1050,y:1450,c:"Red",v:2},{x:2350,y:700,c:"Blue",v:3}
];

const ROCK_SPOTS = [
  {x:280,y:420,v:"1a"},{x:680,y:330,v:"2b"},{x:820,y:780,v:"3a"},
  {x:1000,y:680,v:"4b"},{x:1360,y:450,v:"1b"},{x:1500,y:720,v:"2a"},
  {x:1800,y:540,v:"3b"},{x:2050,y:420,v:"4a"},{x:2200,y:680,v:"1a"},
  {x:1450,y:1280,v:"2b"},{x:900,y:1480,v:"3a"},{x:200,y:1450,v:"4b"},
  {x:2300,y:200,v:"1a"},{x:60,y:700,v:"2b"},{x:1240,y:280,v:"3a"}
];

function scatterDecorations(){
  const layer = document.getElementById("decorLayer");
  if(!layer) return;
  layer.innerHTML = "";

  FLOWER_SPOTS.forEach(function(s){
    const img = document.createElement("img");
    img.src = "Free/Flowers/" + s.c + "/" + s.c + s.v + ".png";
    img.className = "decorFlower";
    img.style.left = s.x + "px";
    img.style.top  = s.y + "px";
    layer.appendChild(img);
  });

  ROCK_SPOTS.forEach(function(s){
    const img = document.createElement("img");
    img.src = "Free/SmallRocks/" + s.v + ".png";
    img.className = "decorRock";
    img.style.left = s.x + "px";
    img.style.top  = s.y + "px";
    layer.appendChild(img);
  });
}

window.openPixelForest = openPixelForest;

function closePixelForest(){
  document.getElementById("pixelForestGame").classList.add("hiddenPage");

  try{
    if(document.fullscreenElement) document.exitFullscreen();
  }catch(e){}

  if(joyLoop) clearInterval(joyLoop);
}

window.closePixelForest = closePixelForest;

function movePixelPlayer(dx, dy){
  const speed = 34;
  const nx = pixelPlayerX + dx * speed;
  const ny = pixelPlayerY + dy * speed;

  if(!isInWater(nx, ny)){
    pixelPlayerX = Math.max(40, Math.min(WORLD_W - 50, nx));
    pixelPlayerY = Math.max(90, Math.min(WORLD_H - 50, ny));
  }

  updatePixelCamera();
}

window.movePixelPlayer = movePixelPlayer;

const WORLD_W = 2400;
const WORLD_H = 1600;

function isInWater(x, y){
  return x > 1545 && x < 1985 && y > 935 && y < 1235;
}

function updatePixelCamera(){
  const player = document.getElementById("pixelPlayer");
  const world = document.getElementById("pixelWorld");
  const miniPlayer = document.getElementById("miniPlayer");

  if(!player || !world) return;

  const zoom = window._pixelZoom || 0.72;

  player.style.left = pixelPlayerX + "px";
  player.style.top = pixelPlayerY + "px";

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  let camX = (screenW / 2) - (pixelPlayerX * zoom);
  let camY = (screenH / 2) - (pixelPlayerY * zoom);

  const worldW = WORLD_W * zoom;
  const worldH = WORLD_H * zoom;

  camX = Math.min(0, Math.max(camX, screenW - worldW));
  camY = Math.min(0, Math.max(camY, screenH - worldH));

  world.style.transformOrigin = "top left";
  world.style.transform = `translate(${camX}px,${camY}px) scale(${zoom})`;

  if(miniPlayer){
    miniPlayer.style.left = ((pixelPlayerX / WORLD_W) * 100) + "%";
    miniPlayer.style.top = ((pixelPlayerY / WORLD_H) * 100) + "%";
  }
}

function interactPixelWorld(){
  const savedTrees = (currentData && currentData.forestTrees) ? currentData.forestTrees : [];

  if(savedTrees.length === 0){
    showInteractPopup(null);
    return;
  }

  let nearest = null;
  let nearestDist = Infinity;

  savedTrees.forEach(function(tree, i){
    if(i >= forestSpots.length) return;
    const spot = forestSpots[i];
    const dx = pixelPlayerX - spot.x;
    const dy = pixelPlayerY - spot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if(dist < nearestDist){
      nearestDist = dist;
      nearest = tree;
    }
  });

  if(nearest && nearestDist < 180){
    showInteractPopup(nearest);
  } else {
    showToast("No trees nearby — walk closer");
  }
}

window.interactPixelWorld = interactPixelWorld;

function showInteractPopup(tree){
  const popup = document.getElementById("interactPopup");
  if(!popup) return;

  if(!tree){
    popup.innerHTML =
      '<div class="interactInner">' +
        '<p class="interactLabel">Your forest is empty</p>' +
        '<p class="interactSub">Complete focus sessions to plant trees</p>' +
        '<button class="interactClose" onclick="closeInteractPopup()"><i class="ri-close-line"></i></button>' +
      '</div>';
    popup.classList.remove("hidden");
    return;
  }

  const names = {
    seed:"Seed",young:"Young Tree",full:"Full Tree",
    rare:"Rare Tree",legendary:"Legendary Tree",dead:"Dead Tree"
  };

  const colors = {
    seed:"#7bc67e",young:"#4caf50",full:"#2e7d32",
    rare:"#9c27b0",legendary:"#ff9800",dead:"#757575"
  };

  const date = new Date(tree.createdAt || Date.now());
  const dateText = date.toLocaleDateString([],{day:"numeric",month:"short",year:"numeric"});
  const name = names[tree.type] || tree.type;
  const color = colors[tree.type] || "#fff";

  popup.innerHTML =
    '<div class="interactInner">' +
      '<div class="interactTreeIcon">' +
        '<img src="' + (TREE_ASSETS[tree.type] || TREE_ASSETS.seed) + '" alt="tree">' +
      '</div>' +
      '<div class="interactInfo">' +
        '<p class="interactLabel" style="color:' + color + '">' + name + '</p>' +
        '<p class="interactSub">' + (tree.minutes || 0) + ' min session &bull; ' + dateText + '</p>' +
      '</div>' +
      '<button class="interactClose" onclick="closeInteractPopup()"><i class="ri-close-line"></i></button>' +
    '</div>';

  popup.classList.remove("hidden");
}

function closeInteractPopup(){
  const popup = document.getElementById("interactPopup");
  if(popup) popup.classList.add("hidden");
}

window.closeInteractPopup = closeInteractPopup;

function openTreeInventory(){
  const savedTrees = (currentData && currentData.forestTrees) ? currentData.forestTrees : [];
  const modal = document.getElementById("inventoryModal");
  const list  = document.getElementById("inventoryList");

  if(!modal || !list) return;

  const names = {
    seed:"Seed",young:"Young Tree",full:"Full Tree",
    rare:"Rare Tree",legendary:"Legendary Tree",dead:"Dead Tree"
  };

  const colors = {
    seed:"#7bc67e",young:"#4caf50",full:"#2e7d32",
    rare:"#9c27b0",legendary:"#ff9800",dead:"#757575"
  };

  if(savedTrees.length === 0){
    list.innerHTML =
      '<div class="invEmpty">' +
        '<i class="ri-plant-line"></i>' +
        '<p>No trees yet</p>' +
        '<small>Complete focus sessions to grow your forest</small>' +
      '</div>';
  } else {
    list.innerHTML = savedTrees.map(function(tree, i){
      const date = new Date(tree.createdAt || Date.now());
      const dateText = date.toLocaleDateString([],{day:"numeric",month:"short"});
      const name = names[tree.type] || tree.type;
      const color = colors[tree.type] || "#fff";
      return (
        '<div class="invItem">' +
          '<img class="invTreeImg" src="' + (TREE_ASSETS[tree.type] || TREE_ASSETS.seed) + '" alt="' + name + '">' +
          '<div class="invItemInfo">' +
            '<span class="invItemName" style="color:' + color + '">' + name + '</span>' +
            '<span class="invItemMeta">' + (tree.minutes || 0) + ' min &bull; ' + dateText + '</span>' +
          '</div>' +
          '<div class="invItemNum">#' + (i + 1) + '</div>' +
        '</div>'
      );
    }).join("");
  }

  modal.classList.remove("hidden");
}

function closeInventory(){
  const modal = document.getElementById("inventoryModal");
  if(modal) modal.classList.add("hidden");
}

window.openTreeInventory = openTreeInventory;
window.closeInventory = closeInventory;

// PIXEL GAME GLOBALS
window._pixelZoom = 0.78;
let joyActive = false;
let joyDX = 0;
let joyDY = 0;
let joyLoop = null;

// Keyboard controls
const keysDown = {};

document.addEventListener("keydown", function(e){
  keysDown[e.key] = true;
});

document.addEventListener("keyup", function(e){
  keysDown[e.key] = false;
});

setInterval(function(){
  const game = document.getElementById("pixelForestGame");
  if(!game || game.classList.contains("hiddenPage")) return;

  const speed = 6;
  let dx = 0;
  let dy = 0;

  if(keysDown["ArrowLeft"]  || keysDown["a"] || keysDown["A"]) dx -= speed;
  if(keysDown["ArrowRight"] || keysDown["d"] || keysDown["D"]) dx += speed;
  if(keysDown["ArrowUp"]    || keysDown["w"] || keysDown["W"]) dy -= speed;
  if(keysDown["ArrowDown"]  || keysDown["s"] || keysDown["S"]) dy += speed;

  if(dx !== 0 || dy !== 0){
    const nx = pixelPlayerX + dx;
    const ny = pixelPlayerY + dy;
    if(!isInWater(nx, ny)){
      pixelPlayerX = Math.max(40, Math.min(WORLD_W - 50, nx));
      pixelPlayerY = Math.max(90, Math.min(WORLD_H - 50, ny));
    }
    updatePixelCamera();
    updatePlayerDirection(dx, dy);
  }
}, 16);

function setupJoystick(){
  const stick = document.getElementById("joyStick");
  const knob = document.getElementById("joyKnob");

  if(!stick || !knob) return;

  let active = false;

  function setJoy(clientX, clientY){
    const rect = stick.getBoundingClientRect();

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;

    const max = 46;
    const dist = Math.hypot(dx, dy);

    if(dist > max){
      dx = dx / dist * max;
      dy = dy / dist * max;
    }

    knob.style.transform = `translate(${dx}px, ${dy}px)`;

    joyDX = dx / max;
    joyDY = dy / max;
  }

  stick.onpointerdown = function(e){
    active = true;
    stick.setPointerCapture(e.pointerId);
    setJoy(e.clientX, e.clientY);

    if(joyLoop) clearInterval(joyLoop);

    joyLoop = setInterval(() => {
      if(!active) return;

      const nx = pixelPlayerX + joyDX * 7;
      const ny = pixelPlayerY + joyDY * 7;

      if(!isInWater(nx, ny)){
        pixelPlayerX = Math.max(40, Math.min(WORLD_W - 50, nx));
        pixelPlayerY = Math.max(90, Math.min(WORLD_H - 50, ny));
      }

      updatePixelCamera();
      updatePlayerDirection(joyDX, joyDY);
    }, 16);
  };

  stick.onpointermove = function(e){
    if(!active) return;
    setJoy(e.clientX, e.clientY);
  };

  stick.onpointerup = function(){
    active = false;
    joyDX = 0;
    joyDY = 0;
    knob.style.transform = "translate(0,0)";
  };

  stick.onpointercancel = stick.onpointerup;
}

setupJoystick();
