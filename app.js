import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCu8db_Oiks_rIaQHw0CPhkjd5RtQM_WTI",
    authDomain: "caloriefit-266fd.firebaseapp.com",
    projectId: "caloriefit-266fd",
    storageBucket: "caloriefit-266fd.firebasestorage.app",
    messagingSenderId: "204189276473",
    appId: "1:204189276473:web:1e0b5e738f3be5d01130e8",
    measurementId: "G-ZLHJHSV9XW"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export let currentUser = null;

export async function loadFromCloud() {
    if (!currentUser) return;
    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.goal) localStorage.setItem('calorieFitGoal', JSON.stringify(data.goal));
        if (data.logs) localStorage.setItem('calorieFitLogs', JSON.stringify(data.logs));
        if (data.weights) localStorage.setItem('calorieFitWeights', JSON.stringify(data.weights));
        if (data.exercises) localStorage.setItem('calorieFitExercises', JSON.stringify(data.exercises));
    }
}

export async function syncToCloud() {
    if (!currentUser) return;
    const goal = JSON.parse(localStorage.getItem('calorieFitGoal')) || null;
    const logs = JSON.parse(localStorage.getItem('calorieFitLogs')) || {};
    const weights = JSON.parse(localStorage.getItem('calorieFitWeights')) || {};
    const exercises = JSON.parse(localStorage.getItem('calorieFitExercises')) || {};

    await setDoc(doc(db, "users", currentUser.uid), {
        goal: goal,
        logs: logs,
        weights: weights,
        exercises: exercises,
        lastUpdated: new Date()
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const setupView = document.getElementById('setup-view');
    const dashboardView = document.getElementById('dashboard-view');
    const communityView = document.getElementById('community-view');
    const historyView = document.getElementById('history-view');
    const bottomNav = document.getElementById('bottom-nav');
    const navItems = document.querySelectorAll('.nav-item');

    const setupForm = document.getElementById('setup-form');
    const warningMsg = document.getElementById('warning-msg');
    const warningText = document.getElementById('warning-text');
    const resetBtn = document.getElementById('reset-btn');

    // Step Elements
    const step1 = document.getElementById('setup-step-1');
    const step2 = document.getElementById('setup-step-2');

    let currentViewDate = new Date(); // 현재 보고 있는 날짜

    function getEffectiveWeight(targetDateObj, fallbackWeight) {
        const weights = JSON.parse(localStorage.getItem('calorieFitWeights')) || {};
        const targetTime = targetDateObj.getTime();
        let closestW = fallbackWeight;
        let closestTime = 0;
        for (let d in weights) {
            const [y, m, day] = d.split('-');
            const logTime = new Date(y, m - 1, day).getTime();
            if (logTime <= targetTime && logTime > closestTime) {
                closestTime = logTime;
                closestW = weights[d];
            }
        }
        return closestW;
    }

    function recalcTDEE(weight, gender, age, height) {
        let bmr = gender === 'male'
            ? (10 * weight) + (6.25 * height) - (5 * age) + 5
            : (10 * weight) + (6.25 * height) - (5 * age) - 161;
        return Math.round(bmr * 1.2); // 활동량 기본 1.2로 고정
    }

    // 음식 평균 칼로리 사전
    const foodDictionary = {
        '바나나': 90, '사과': 52, '고구마': 128, '단호박': 60,
        '방울토마토': 16, '토마토': 18, '수박': 30, '귤': 40,
        '닭가슴살': 110, '계란': 75, '삶은계란': 75, '구운계란': 70,
        '밥': 300, '공기밥': 300, '햇반': 310, '현미밥': 250,
        '라면': 500, '신라면': 500, '진라면': 500, '불닭볶음면': 530,
        '우유': 130, '아메리카노': 10, '라떼': 150, '카페라떼': 150, '믹스커피': 50,
        '콜라': 110, '제로콜라': 0, '사이다': 110,
        '삼겹살': 330, '소고기': 250, '목살': 270,
        '짜장면': 800, '짬뽕': 700, '탕수육': 500,
        '치킨': 300, '양념치킨': 350, '후라이드치킨': 300,
        '피자': 250, '햄버거': 500, '감자튀김': 350,
        '김밥': 400, '참치김밥': 500, '떡볶이': 300, '순대': 300, '튀김': 200,
        '제육볶음': 300, '갈비탕': 450, '김치찌개': 250, '된장찌개': 200,
        '샌드위치': 400, '서브웨이': 350, '샐러드': 150,
        '아몬드': 60, '호두': 65, '땅콩': 50,
        '식빵': 100, '베이글': 250, '소금빵': 200,
        '초콜릿': 150, '아이스크림': 200, '과자': 300,
        '연어': 150, '광어': 100, '초밥': 50
    };

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('targetDate').min = tomorrow.toISOString().split('T')[0];

    const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const startDateEl = document.getElementById('startDate');
    if (startDateEl) {
        startDateEl.value = todayStr;
        startDateEl.max = todayStr;
    }

    const loginView = document.getElementById('login-view');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('user-display-name').textContent = `${user.displayName}님`;

            await loadFromCloud();

            loginView.classList.add('hidden');

            const storedGoal = localStorage.getItem('calorieFitGoal');
            if (storedGoal) {
                showDashboard(JSON.parse(storedGoal));
            } else {
                if (bottomNav) bottomNav.classList.add('hidden');
                setupView.classList.remove('hidden');
            }
        } else {
            currentUser = null;
            if (sessionStorage.getItem('calorieFitGuest') === 'true') {
                document.getElementById('user-display-name').innerHTML = '<span style="color:#f43f5e;"><i class="ri-alert-line"></i> 게스트 (저장불가)</span>';
                loginView.classList.add('hidden');
                const storedGoal = localStorage.getItem('calorieFitGoal');
                if (storedGoal) {
                    showDashboard(JSON.parse(storedGoal));
                } else {
                    if (bottomNav) bottomNav.classList.add('hidden');
                    setupView.classList.remove('hidden');
                }
            } else {
                loginView.classList.remove('hidden');
                setupView.classList.add('hidden');
                dashboardView.classList.add('hidden');
                if (communityView) communityView.classList.add('hidden');
                if (historyView) historyView.classList.add('hidden');
                if (bottomNav) bottomNav.classList.add('hidden');
            }
        }
    });

    document.getElementById('google-login-btn').addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => {
            console.error(error);
            alert("로그인에 실패했습니다: " + error.message);
        });
    });

    document.getElementById('github-login-btn').addEventListener('click', () => {
        const provider = new GithubAuthProvider();
        signInWithPopup(auth, provider).catch(error => {
            console.error(error);
            alert("깃허브 로그인에 실패했습니다. Firebase 콘솔 설정을 확인하세요!\n" + error.message);
        });
    });

    const guestBtn = document.getElementById('guest-login-btn');
    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            sessionStorage.setItem('calorieFitGuest', 'true');
            document.getElementById('user-display-name').innerHTML = '<span style="color:#f43f5e;"><i class="ri-alert-line"></i> 게스트 (저장불가)</span>';
            loginView.classList.add('hidden');
            const storedGoal = localStorage.getItem('calorieFitGoal');
            if (storedGoal) {
                showDashboard(JSON.parse(storedGoal));
            } else {
                if (bottomNav) bottomNav.classList.add('hidden');
                setupView.classList.remove('hidden');
            }
        });
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
        signOut(auth).then(() => {
            localStorage.removeItem('calorieFitGoal');
            localStorage.removeItem('calorieFitLogs');
            localStorage.removeItem('calorieFitWeights');
            localStorage.removeItem('calorieFitExercises');
            sessionStorage.removeItem('calorieFitGuest');
            location.reload();
        });
    });

    // --- Onboarding Setup Progression ---
    document.getElementById('next-step-btn').addEventListener('click', () => {
        const age = document.getElementById('age').value;
        const height = document.getElementById('height').value;
        if (!age || !height) {
            showWarning("나이와 키를 먼저 입력해주세요!");
            return;
        }
        warningMsg.classList.add('hidden');
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
    });

    document.getElementById('prev-step-btn').addEventListener('click', () => {
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
    });

    setupForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const gender = document.querySelector('input[name="gender"]:checked').value;
        const age = parseInt(document.getElementById('age').value);
        const height = parseFloat(document.getElementById('height').value);
        const currentWeight = parseFloat(document.getElementById('currentWeight').value);
        const targetWeight = parseFloat(document.getElementById('targetWeight').value);
        const targetDateStr = document.getElementById('targetDate').value;
        const startDateStr = document.getElementById('startDate').value || new Date().toISOString().split('T')[0];

        if (targetWeight >= currentWeight) {
            showWarning("목표 체중은 현재 체중보다 적어야 합니다.");
            return;
        }

        const targetDate = new Date(targetDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const timeDiff = targetDate.getTime() - today.getTime();
        const daysRemaining = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)));

        let bmr;
        if (gender === 'male') {
            bmr = (10 * currentWeight) + (6.25 * height) - (5 * age) + 5;
        } else {
            bmr = (10 * currentWeight) + (6.25 * height) - (5 * age) - 161;
        }

        const tdee = Math.round(bmr * 1.2);

        const weightToLose = currentWeight - targetWeight;
        const totalCaloriesToLose = weightToLose * 7700;
        const dailyDeficit = Math.round(totalCaloriesToLose / daysRemaining);
        let dailyTarget = tdee - dailyDeficit;

        const safeLimit = 1000;
        if (dailyTarget < safeLimit) {
            showWarning(`주의: 계산된 하루 목표 칼로리(${dailyTarget}kcal)가 너무 낮습니다. 최하 ${safeLimit}kcal 이상을 권장합니다. 기간을 늘려주세요.`);
            return;
        }

        const goalData = {
            startDate: startDateStr,
            gender, age, height, currentWeight, targetWeight,
            targetDate: targetDateStr, tdee, dailyDeficit, dailyTarget,
            totalCaloriesToLose, weightToLose
        };

        localStorage.setItem('calorieFitGoal', JSON.stringify(goalData));
        syncToCloud();
        // 리셋 뷰 초기화
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
        showDashboard(goalData);
    });

    resetBtn.addEventListener('click', () => {
        if (confirm("정말 목표를 다시 설정하시겠습니까? (기타 섭취/운동 기록은 유지됩니다)")) {
            localStorage.removeItem('calorieFitGoal');
            syncToCloud();
            dashboardView.classList.add('hidden');
            if (communityView) communityView.classList.add('hidden');
            if (historyView) historyView.classList.add('hidden');
            if (bottomNav) bottomNav.classList.add('hidden');
            setupView.classList.remove('hidden');
        }
    });

    function showWarning(text) {
        warningText.textContent = text;
        warningMsg.classList.remove('hidden');
    }

    // History View Render
    function renderHistory() {
        const historyTimeline = document.getElementById('history-timeline');
        historyTimeline.innerHTML = '';

        let logs = JSON.parse(localStorage.getItem('calorieFitLogs')) || {};
        let weights = JSON.parse(localStorage.getItem('calorieFitWeights')) || {};
        let exercises = JSON.parse(localStorage.getItem('calorieFitExercises')) || {};

        const allDatesSet = new Set([...Object.keys(logs), ...Object.keys(weights), ...Object.keys(exercises)]);
        const sortedDates = Array.from(allDatesSet).sort((a, b) => b.localeCompare(a));

        if (sortedDates.length === 0) {
            historyTimeline.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:2rem 0;">기록이 없습니다.</p>';
            return;
        }

        sortedDates.forEach(dateStr => {
            const [y, m, d] = dateStr.split('-');
            const dObj = new Date(y, m - 1, d);
            const displayMonth = `${dObj.getMonth() + 1}월`;
            const displayDay = `${dObj.getDate()}`;

            let w = weights[dateStr] ? `${weights[dateStr]}kg` : '-';

            let cList = logs[dateStr] || [];
            let cTot = cList.reduce((sum, x) => sum + x.calories, 0);
            let cDisp = cTot > 0 ? `${cTot} kcal` : '-';

            let eList = exercises[dateStr] || [];
            let eTot = eList.reduce((sum, x) => sum + x.calories, 0);
            let eDisp = eTot > 0 ? `${eTot} kcal` : '-';

            const li = document.createElement('li');
            li.className = 'history-item';
            li.innerHTML = `
                <div class="date-box">
                    <div class="month">${displayMonth}</div>
                    <div class="day">${displayDay}</div>
                </div>
                <div class="stats-box">
                    <div class="stats-row weight"><span><i class="ri-scales-3-line"></i> 체중</span> <span class="val">${w}</span></div>
                    <div class="stats-row food"><span><i class="ri-restaurant-line"></i> 섭취</span> <span class="val">${cDisp}</span></div>
                    <div class="stats-row exercise"><span><i class="ri-run-line"></i> 운동</span> <span class="val">${eDisp}</span></div>
                </div>
            `;
            historyTimeline.appendChild(li);
        });
    }

    function showDashboard(goalData) {
        setupView.classList.add('hidden');

        if (communityView) communityView.classList.add('hidden');
        if (historyView) historyView.classList.add('hidden');
        dashboardView.classList.remove('hidden');

        if (bottomNav) bottomNav.classList.remove('hidden');
        navItems.forEach(item => {
            if (item.getAttribute('data-target') === 'dashboard-view') {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        currentViewDate = new Date();
        renderDashboardDate(goalData);

        document.getElementById('prev-date').onclick = () => {
            currentViewDate.setDate(currentViewDate.getDate() - 1);
            renderDashboardDate(goalData);
        };

        document.getElementById('next-date').onclick = () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const view = new Date(currentViewDate);
            view.setHours(0, 0, 0, 0);

            if (view < today) {
                currentViewDate.setDate(currentViewDate.getDate() + 1);
                renderDashboardDate(goalData);
            }
        };

        navItems.forEach(btn => {
            btn.onclick = () => {
                navItems.forEach(item => item.classList.remove('active'));
                btn.classList.add('active');

                const targetId = btn.getAttribute('data-target');
                dashboardView.classList.add('hidden');
                if (communityView) communityView.classList.add('hidden');
                if (historyView) historyView.classList.add('hidden');

                const targetView = document.getElementById(targetId);
                if (targetView) targetView.classList.remove('hidden');

                if (targetId === 'history-view') {
                    renderHistory();
                }
            };
        });
    }

    function renderDashboardDate(goalData) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const view = new Date(currentViewDate);
        view.setHours(0, 0, 0, 0);

        const nextBtn = document.getElementById('next-date');
        const dashboardTitle = document.getElementById('dashboard-title');

        if (view.getTime() === today.getTime()) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.3';
            nextBtn.style.cursor = 'not-allowed';
            dashboardTitle.textContent = "오늘의 기록";
        } else {
            nextBtn.disabled = false;
            nextBtn.style.opacity = '1';
            nextBtn.style.cursor = 'pointer';
            dashboardTitle.textContent = "과거의 기록";
        }

        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        document.getElementById('date-display').textContent = currentViewDate.toLocaleDateString('ko-KR', dateOptions);

        let startDateValue = goalData.startDate || (new Date()).toISOString().split('T')[0];
        const [sYr, sMo, sDa] = startDateValue.split('-');
        const startD = new Date(sYr, sMo - 1, sDa);
        const endD = new Date(view.getFullYear(), view.getMonth(), view.getDate());
        const tzoffset = view.getTimezoneOffset() * 60000;
        const targetDateStrKey = (new Date(view.getTime() - tzoffset)).toISOString().split('T')[0];

        // --- 동적 체중 & 기본 TDEE ---
        const effectiveWeight = getEffectiveWeight(endD, goalData.currentWeight);
        const baseTDEE = recalcTDEE(effectiveWeight, goalData.gender, goalData.age, goalData.height);

        // --- 오늘의 운동 및 최종 TDEE ---
        const exercisesLogs = JSON.parse(localStorage.getItem('calorieFitExercises')) || {};
        const exercisesForDay = exercisesLogs[targetDateStrKey] || [];
        const todayExerciseCalories = exercisesForDay.reduce((sum, e) => sum + e.calories, 0);

        const finalTDEE = baseTDEE + todayExerciseCalories;
        let dynamicDailyTarget = finalTDEE - goalData.dailyDeficit;
        const safeLimit = 1000;
        if (dynamicDailyTarget < safeLimit) dynamicDailyTarget = safeLimit;

        // 체중 로깅 UI 업데이트
        const wForm = document.getElementById('weight-form');
        if (wForm) {
            const wInput = document.getElementById('daily-weight-input');
            const wDisplay = document.getElementById('weight-log-display');
            const weights = JSON.parse(localStorage.getItem('calorieFitWeights')) || {};

            if (weights[targetDateStrKey]) {
                wInput.value = weights[targetDateStrKey];
                wInput.style.borderColor = 'var(--success)';
                wInput.style.color = 'var(--success)';
                if (wDisplay) wDisplay.style.display = 'none';
            } else {
                wInput.value = effectiveWeight;
                wInput.style.borderColor = 'var(--primary)';
                wInput.style.color = 'var(--text-main)';
                if (wDisplay) wDisplay.style.display = 'none';
            }

            const newWForm = wForm.cloneNode(true);
            wForm.parentNode.replaceChild(newWForm, wForm);
            newWForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const val = parseFloat(document.getElementById('daily-weight-input').value);
                if (!val) return;
                const w = JSON.parse(localStorage.getItem('calorieFitWeights')) || {};
                w[targetDateStrKey] = val;
                localStorage.setItem('calorieFitWeights', JSON.stringify(w));
                syncToCloud();
                const renderDashboardDateUpdate = () => {
                    const stored = JSON.parse(localStorage.getItem('calorieFitGoal'));
                    if (stored) renderDashboardDate(stored);
                };
                renderDashboardDateUpdate();
            });
        }

        const isBeforeStart = endD.getTime() < startD.getTime();

        if (isBeforeStart) {
            dashboardTitle.textContent = "시작일 이전 기록";
            document.getElementById('d-day-badge').textContent = "-";
            document.getElementById('cumulative-deficit').textContent = "-";
            document.getElementById('expected-loss').textContent = "-";
            document.getElementById('weight-remaining').textContent = "-";
            document.getElementById('tdee-val').textContent = baseTDEE.toLocaleString();
            document.getElementById('today-exercise-calories').textContent = todayExerciseCalories.toLocaleString();
            document.getElementById('calories-target').textContent = `/ ${finalTDEE.toLocaleString()} kcal`;

            initExerciseLogger(currentViewDate);
            initFoodLogger(finalTDEE, currentViewDate, finalTDEE);
        } else {
            const targetDate = new Date(goalData.targetDate);
            const timeDiff = targetDate.getTime() - view.getTime();
            const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));

            if (daysRemaining <= 0) {
                document.getElementById('d-day-badge').textContent = "D-Day 지남";
            } else {
                document.getElementById('d-day-badge').innerHTML = `D-<span id="days-remaining">${daysRemaining}</span>`;
            }

            let logs = JSON.parse(localStorage.getItem('calorieFitLogs')) || {};
            let eLogs = JSON.parse(localStorage.getItem('calorieFitExercises')) || {};
            let cumulativeDeficit = 0;

            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                const tz = d.getTimezoneOffset() * 60000;
                const dateStr = (new Date(d.getTime() - tz)).toISOString().split('T')[0];

                if (logs[dateStr]) {
                    const consumed = logs[dateStr].reduce((sum, item) => sum + item.calories, 0);
                    if (consumed > 0) {
                        const hW = getEffectiveWeight(d, goalData.currentWeight);
                        const hBaseTDEE = recalcTDEE(hW, goalData.gender, goalData.age, goalData.height);
                        const hEx = (eLogs[dateStr] || []).reduce((s, x) => s + x.calories, 0);
                        const hFinalTDEE = hBaseTDEE + hEx;
                        cumulativeDeficit += (hFinalTDEE - consumed);
                    }
                }
            }

            document.getElementById('cumulative-deficit').textContent = cumulativeDeficit.toLocaleString();
            const expectedLoss = (cumulativeDeficit / 7700).toFixed(2);
            document.getElementById('expected-loss').textContent = expectedLoss;

            // 남은 감량 무게도 현재 체중에 맞춰 동적 계산
            const startW = goalData.currentWeight;
            const currentLoss = startW - effectiveWeight;
            const remainWg = Math.max(0, goalData.weightToLose - currentLoss).toFixed(1);

            document.getElementById('weight-remaining').textContent = remainWg;
            document.getElementById('tdee-val').textContent = baseTDEE.toLocaleString();
            document.getElementById('today-exercise-calories').textContent = todayExerciseCalories.toLocaleString();
            document.getElementById('calories-target').textContent = `/ ${dynamicDailyTarget.toLocaleString()} kcal`;

            initExerciseLogger(currentViewDate);
            initFoodLogger(dynamicDailyTarget, currentViewDate, finalTDEE);
        }
    }

    // --- Exercise Logger Logic ---
    function initExerciseLogger(viewDate) {
        const form = document.getElementById('exercise-form');
        const list = document.getElementById('exercise-list');
        const emptyState = document.getElementById('exercise-empty-state');

        const tzoffset = viewDate.getTimezoneOffset() * 60000;
        const targetKey = (new Date(viewDate.getTime() - tzoffset)).toISOString().split('T')[0];

        let logs = JSON.parse(localStorage.getItem('calorieFitExercises')) || {};
        if (!logs[targetKey]) logs[targetKey] = [];

        const updateUI = () => {
            list.innerHTML = '';
            if (logs[targetKey].length === 0) {
                emptyState.style.display = 'flex';
            } else {
                emptyState.style.display = 'none';
                logs[targetKey].forEach(item => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div class="food-info">
                            <span class="food-name" style="color:var(--success);">${item.name}</span>
                            <span class="food-cal">${item.calories} kcal</span>
                        </div>
                        <button class="ex-delete-btn delete-btn" data-id="${item.id}" style="color:var(--success); background:rgba(34, 197, 94, 0.1);"><i class="ri-delete-bin-line"></i></button>
                    `;
                    list.appendChild(li);
                });
            }

            document.querySelectorAll('.ex-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    logs[targetKey] = logs[targetKey].filter(i => i.id !== id);
                    localStorage.setItem('calorieFitExercises', JSON.stringify(logs));
                    syncToCloud();
                    const stored = JSON.parse(localStorage.getItem('calorieFitGoal'));
                    if (stored) renderDashboardDate(stored); // Re-render to update Math
                });
            });
        };

        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        const nameInput = document.getElementById('exercise-name');
        const calInput = document.getElementById('exercise-calories');

        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const calories = parseInt(calInput.value);
            if (!name || isNaN(calories)) return;

            logs[targetKey].push({ id: Date.now().toString(), name, calories });
            localStorage.setItem('calorieFitExercises', JSON.stringify(logs));
            syncToCloud();

            nameInput.value = '';
            calInput.value = '';

            const stored = JSON.parse(localStorage.getItem('calorieFitGoal'));
            if (stored) renderDashboardDate(stored); // Re-render to calculate new TDEE limits
        });

        updateUI();
    }

    // --- Food Logger Logic ---
    function initFoodLogger(dailyTarget, viewDate, finalTDEE) {
        const foodForm = document.getElementById('food-form');
        const foodList = document.getElementById('food-list');
        const emptyState = document.getElementById('empty-state');
        const calConsumedEl = document.getElementById('calories-consumed');
        const calRemainingEl = document.getElementById('calories-remaining');
        const progressCircle = document.getElementById('progress-circle');

        const radius = progressCircle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressCircle.style.strokeDashoffset = circumference;

        const tzoffset = viewDate.getTimezoneOffset() * 60000;
        const targetKey = (new Date(viewDate.getTime() - tzoffset)).toISOString().split('T')[0];

        let logs = JSON.parse(localStorage.getItem('calorieFitLogs')) || {};
        if (!logs[targetKey]) logs[targetKey] = [];

        const updateUI = () => {
            let totalConsumed = 0;
            foodList.innerHTML = '';

            if (logs[targetKey].length === 0) {
                emptyState.style.display = 'flex';
            } else {
                emptyState.style.display = 'none';
                logs[targetKey].forEach(item => {
                    totalConsumed += item.calories;
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div class="food-info">
                            <span class="food-name">${item.name}</span>
                            <span class="food-cal">${item.calories} kcal</span>
                        </div>
                        <button class="fd-delete-btn delete-btn" data-id="${item.id}"><i class="ri-delete-bin-line"></i></button>
                    `;
                    foodList.appendChild(li);
                });
            }

            calConsumedEl.textContent = totalConsumed;
            let remaining = dailyTarget - totalConsumed;
            calRemainingEl.textContent = remaining;
            calRemainingEl.className = `value ${remaining < 0 ? 'text-red' : 'accent'}`;

            const todayDeficit = finalTDEE - totalConsumed;
            const tfEl = document.getElementById('today-deficit');
            if (tfEl) {
                tfEl.textContent = todayDeficit.toLocaleString();
                if (todayDeficit < 0) {
                    tfEl.className = "value text-red";
                } else {
                    tfEl.className = "value highlight";
                }
            }

            let progress = totalConsumed / dailyTarget;
            if (progress > 1) progress = 1;
            const offset = circumference - progress * circumference;
            progressCircle.style.strokeDashoffset = offset;

            document.querySelectorAll('.fd-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    logs[targetKey] = logs[targetKey].filter(i => i.id !== id);
                    localStorage.setItem('calorieFitLogs', JSON.stringify(logs));
                    syncToCloud();

                    const stored = JSON.parse(localStorage.getItem('calorieFitGoal'));
                    if (stored) renderDashboardDate(stored); // Re-render to update cumulative
                });
            });
        };

        const newFoodForm = foodForm.cloneNode(true);
        foodForm.parentNode.replaceChild(newFoodForm, foodForm);

        const nameInput = document.getElementById('food-name');
        const calInput = document.getElementById('food-calories');

        nameInput.addEventListener('input', (e) => {
            const inputVal = e.target.value.trim().replace(/\s/g, '');
            let matchedCalorie = null;

            if (foodDictionary[inputVal]) {
                matchedCalorie = foodDictionary[inputVal];
            } else {
                for (const food in foodDictionary) {
                    if (inputVal.includes(food)) {
                        matchedCalorie = foodDictionary[food];
                        break;
                    }
                }
            }

            if (matchedCalorie !== null) {
                calInput.value = matchedCalorie;
                calInput.classList.add('auto-filled');
            }
        });

        newFoodForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const calories = parseInt(calInput.value);

            if (!name || isNaN(calories)) return;

            const newItem = { id: Date.now().toString(), name, calories };
            logs[targetKey].push(newItem);
            localStorage.setItem('calorieFitLogs', JSON.stringify(logs));
            syncToCloud();

            nameInput.value = '';
            calInput.value = '';

            const stored = JSON.parse(localStorage.getItem('calorieFitGoal'));
            if (stored) renderDashboardDate(stored);
        });

        updateUI();
    }

    // --- Chart Logic ---
    let weightChartInstance = null;
    const chartModal = document.getElementById('chart-modal');

    function renderWeightChart(rangeChoice) {
        const storedGoal = localStorage.getItem('calorieFitGoal');
        if (!storedGoal) return;
        const goalData = JSON.parse(storedGoal);

        const ctx = document.getElementById('weightChart').getContext('2d');

        let labels = [];
        let dataPoints = [];

        let stepDays = 1;
        let dataCount = 14;

        if (rangeChoice === 'week') {
            stepDays = 7;
            dataCount = 8;
        } else if (rangeChoice === 'month') {
            stepDays = 30;
            dataCount = 6;
        }

        for (let i = dataCount - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - (i * stepDays));
            let labelStr = rangeChoice === 'month' ? `${d.getMonth() + 1}월` : `${d.getMonth() + 1}/${d.getDate()}`;
            labels.push(labelStr);
            let w = getEffectiveWeight(d, goalData.currentWeight);
            dataPoints.push(w);
        }

        if (weightChartInstance) {
            weightChartInstance.destroy();
        }

        weightChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '체중 (kg)',
                    data: dataPoints,
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244, 63, 94, 0.2)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#f43f5e'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        min: Math.floor(Math.min(...dataPoints)) - 2,
                        max: Math.ceil(Math.max(...dataPoints)) + 2
                    }
                }
            }
        });
    }

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#open-chart-btn');
        if (btn) {
            chartModal.classList.remove('hidden');
            const checkedRange = document.querySelector('input[name="chart-range"]:checked').value;
            renderWeightChart(checkedRange);
        }
    });

    document.getElementById('close-chart-btn').addEventListener('click', () => {
        chartModal.classList.add('hidden');
    });

    document.querySelectorAll('input[name="chart-range"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            renderWeightChart(e.target.value);
        });
    });
});
