// ST-Sudoku Extension
// Injects a Sudoku game button into SillyTavern UI

const extensionName = 'ST-Sudoku';

// ─── Sudoku Generator ────────────────────────────────────────────────────────

function generateFullBoard() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));

    function isValid(board, row, col, num) {
        for (let i = 0; i < 9; i++) {
            if (board[row][i] === num) return false;
            if (board[i][col] === num) return false;
            const br = 3 * Math.floor(row / 3) + Math.floor(i / 3);
            const bc = 3 * Math.floor(col / 3) + (i % 3);
            if (board[br][bc] === num) return false;
        }
        return true;
    }

    function solve(board) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0) {
                    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of nums) {
                        if (isValid(board, row, col, num)) {
                            board[row][col] = num;
                            if (solve(board)) return true;
                            board[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    solve(board);
    return board;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function createPuzzle(solution, difficulty) {
    const removals = { easy: 36, medium: 46, hard: 54 };
    const count = removals[difficulty] || 36;
    const puzzle = solution.map(r => [...r]);
    let removed = 0;
    const cells = shuffle([...Array(81).keys()]);
    for (const idx of cells) {
        if (removed >= count) break;
        const row = Math.floor(idx / 9);
        const col = idx % 9;
        puzzle[row][col] = 0;
        removed++;
    }
    return puzzle;
}

// ─── State ───────────────────────────────────────────────────────────────────

let state = {
    solution: null,
    puzzle: null,
    userBoard: null,
    selected: null,
    notes: null,
    notesMode: false,
    mistakes: 0,
    maxMistakes: 3,
    difficulty: 'easy',
    timer: 0,
    timerInterval: null,
    gameOver: false,
    won: false,
    history: [],
};

function startNewGame(difficulty) {
    clearInterval(state.timerInterval);
    const solution = generateFullBoard();
    const puzzle = createPuzzle(solution, difficulty);
    state = {
        solution,
        puzzle,
        userBoard: puzzle.map(r => [...r]),
        selected: null,
        notes: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set())),
        notesMode: false,
        mistakes: 0,
        maxMistakes: 3,
        difficulty,
        timer: 0,
        timerInterval: null,
        gameOver: false,
        won: false,
        history: [],
    };
    state.timerInterval = setInterval(() => {
        if (!state.gameOver && !state.won) {
            state.timer++;
            updateTimer();
        }
    }, 1000);
    renderBoard();
    updateMistakes();
    updateTimer();
    updateNumberCounts();
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderBoard() {
    const grid = document.getElementById('sudoku-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div');
            cell.className = 'sdk-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            const isGiven = state.puzzle[row][col] !== 0;
            const val = state.userBoard[row][col];
            const noteSet = state.notes[row][col];

            if (isGiven) cell.classList.add('sdk-given');
            if (state.gameOver && !isGiven && val !== 0 && val !== state.solution[row][col]) {
                cell.classList.add('sdk-wrong');
            }

            // Highlight selected
            if (state.selected) {
                const [sr, sc] = state.selected;
                const sameNum = val !== 0 && val === state.userBoard[sr][sc];
                if (row === sr && col === sc) {
                    cell.classList.add('sdk-selected');
                } else if (row === sr || col === sc || (Math.floor(row/3) === Math.floor(sr/3) && Math.floor(col/3) === Math.floor(sc/3))) {
                    cell.classList.add('sdk-highlight');
                }
                if (sameNum && val !== 0) cell.classList.add('sdk-same-num');
            }

            if (val !== 0) {
                cell.textContent = val;
                if (!isGiven) {
                    if (val !== state.solution[row][col]) {
                        cell.classList.add('sdk-error');
                    } else {
                        cell.classList.add('sdk-user');
                    }
                }
            } else if (noteSet.size > 0) {
                cell.classList.add('sdk-notes-cell');
                const noteGrid = document.createElement('div');
                noteGrid.className = 'sdk-note-grid';
                for (let n = 1; n <= 9; n++) {
                    const nd = document.createElement('span');
                    nd.textContent = noteSet.has(n) ? n : '';
                    noteGrid.appendChild(nd);
                }
                cell.appendChild(noteGrid);
            }

            cell.addEventListener('click', () => onCellClick(row, col));
            grid.appendChild(cell);
        }
    }
}

function onCellClick(row, col) {
    if (state.gameOver || state.won) return;
    state.selected = [row, col];
    renderBoard();
}

function onNumberInput(num) {
    if (!state.selected || state.gameOver || state.won) return;
    const [row, col] = state.selected;
    if (state.puzzle[row][col] !== 0) return;

    if (state.notesMode) {
        if (state.userBoard[row][col] !== 0) return;
        const set = state.notes[row][col];
        if (set.has(num)) set.delete(num);
        else set.add(num);
        renderBoard();
        return;
    }

    // Save history
    state.history.push({
        row, col,
        prev: state.userBoard[row][col],
        prevNotes: new Set(state.notes[row][col]),
    });

    state.userBoard[row][col] = num;
    state.notes[row][col].clear();

    if (num !== 0 && num !== state.solution[row][col]) {
        state.mistakes++;
        updateMistakes();
        if (state.mistakes >= state.maxMistakes) {
            state.gameOver = true;
            clearInterval(state.timerInterval);
            renderBoard();
            showOverlay('lose');
            return;
        }
    }

    renderBoard();
    updateNumberCounts();

    // Check win
    if (checkWin()) {
        state.won = true;
        clearInterval(state.timerInterval);
        showOverlay('win');
    }
}

function onErase() {
    if (!state.selected || state.gameOver || state.won) return;
    const [row, col] = state.selected;
    if (state.puzzle[row][col] !== 0) return;
    state.history.push({ row, col, prev: state.userBoard[row][col], prevNotes: new Set(state.notes[row][col]) });
    state.userBoard[row][col] = 0;
    state.notes[row][col].clear();
    renderBoard();
    updateNumberCounts();
}

function onUndo() {
    if (!state.history.length) return;
    const last = state.history.pop();
    state.userBoard[last.row][last.col] = last.prev;
    state.notes[last.row][last.col] = last.prevNotes;
    renderBoard();
    updateNumberCounts();
}

function checkWin() {
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (state.userBoard[r][c] !== state.solution[r][c]) return false;
    return true;
}

function updateTimer() {
    const el = document.getElementById('sdk-timer');
    if (!el) return;
    const m = String(Math.floor(state.timer / 60)).padStart(2, '0');
    const s = String(state.timer % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
}

function updateMistakes() {
    const el = document.getElementById('sdk-mistakes');
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < state.maxMistakes; i++) {
        const dot = document.createElement('span');
        dot.className = 'sdk-mistake-dot' + (i < state.mistakes ? ' sdk-mistake-filled' : '');
        el.appendChild(dot);
    }
}

function updateNumberCounts() {
    for (let n = 1; n <= 9; n++) {
        const el = document.getElementById(`sdk-num-${n}`);
        if (!el) continue;
        let count = 0;
        for (let r = 0; r < 9; r++)
            for (let c = 0; c < 9; c++)
                if (state.userBoard[r][c] === n) count++;
        el.classList.toggle('sdk-num-complete', count >= 9);
    }
}

function showOverlay(type) {
    const overlay = document.getElementById('sdk-overlay');
    if (!overlay) return;
    const title = overlay.querySelector('.sdk-overlay-title');
    const sub = overlay.querySelector('.sdk-overlay-sub');
    if (type === 'win') {
        title.textContent = '🎉 Победа!';
        const m = String(Math.floor(state.timer / 60)).padStart(2, '0');
        const s = String(state.timer % 60).padStart(2, '0');
        sub.textContent = `Время: ${m}:${s} · Ошибки: ${state.mistakes}/${state.maxMistakes}`;
    } else {
        title.textContent = '😔 Попытки закончились';
        sub.textContent = 'Хочешь попробовать снова?';
    }
    overlay.classList.remove('sdk-hidden');
}

// ─── Modal HTML ──────────────────────────────────────────────────────────────

function buildModal() {
    const modal = document.createElement('div');
    modal.id = 'sdk-modal';
    modal.className = 'sdk-hidden';
    modal.innerHTML = `
        <div class="sdk-backdrop" id="sdk-backdrop"></div>
        <div class="sdk-window">
            <div class="sdk-header">
                <div class="sdk-header-left">
                    <span class="sdk-logo">SUDOKU</span>
                    <div class="sdk-diff-tabs">
                        <button class="sdk-diff-btn active" data-diff="easy">Легко</button>
                        <button class="sdk-diff-btn" data-diff="medium">Средне</button>
                        <button class="sdk-diff-btn" data-diff="hard">Сложно</button>
                    </div>
                </div>
                <div class="sdk-header-right">
                    <div class="sdk-stat">
                        <span class="sdk-stat-label">Ошибки</span>
                        <div id="sdk-mistakes" class="sdk-mistakes"></div>
                    </div>
                    <div class="sdk-stat">
                        <span class="sdk-stat-label">Время</span>
                        <span id="sdk-timer" class="sdk-timer-val">00:00</span>
                    </div>
                    <button class="sdk-close-btn" id="sdk-close">✕</button>
                </div>
            </div>

            <div class="sdk-body">
                <div class="sdk-grid-wrap">
                    <div id="sudoku-grid" class="sdk-grid"></div>
                    <div id="sdk-overlay" class="sdk-overlay sdk-hidden">
                        <div class="sdk-overlay-content">
                            <div class="sdk-overlay-title"></div>
                            <div class="sdk-overlay-sub"></div>
                            <button class="sdk-overlay-btn" id="sdk-overlay-new">Новая игра</button>
                        </div>
                    </div>
                </div>

                <div class="sdk-controls">
                    <div class="sdk-action-row">
                        <button class="sdk-action-btn" id="sdk-undo">
                            <span class="sdk-action-icon">↩</span>
                            <span>Отмена</span>
                        </button>
                        <button class="sdk-action-btn" id="sdk-erase">
                            <span class="sdk-action-icon">⌫</span>
                            <span>Стереть</span>
                        </button>
                        <button class="sdk-action-btn" id="sdk-notes-toggle">
                            <span class="sdk-action-icon">✏</span>
                            <span>Заметки</span>
                        </button>
                    </div>
                    <div class="sdk-numpad">
                        ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="sdk-num-btn" id="sdk-num-${n}" data-num="${n}">${n}</button>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    bindEvents();
}

function bindEvents() {
    document.getElementById('sdk-close').addEventListener('click', closeModal);
    document.getElementById('sdk-backdrop').addEventListener('click', closeModal);

    document.getElementById('sdk-undo').addEventListener('click', onUndo);
    document.getElementById('sdk-erase').addEventListener('click', onErase);

    document.getElementById('sdk-notes-toggle').addEventListener('click', () => {
        state.notesMode = !state.notesMode;
        document.getElementById('sdk-notes-toggle').classList.toggle('sdk-action-active', state.notesMode);
    });

    document.querySelectorAll('.sdk-num-btn').forEach(btn => {
        btn.addEventListener('click', () => onNumberInput(Number(btn.dataset.num)));
    });

    document.querySelectorAll('.sdk-diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sdk-diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('sdk-overlay').classList.add('sdk-hidden');
            startNewGame(btn.dataset.diff);
        });
    });

    document.getElementById('sdk-overlay-new').addEventListener('click', () => {
        document.getElementById('sdk-overlay').classList.add('sdk-hidden');
        startNewGame(state.difficulty);
    });

    document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
    const modal = document.getElementById('sdk-modal');
    if (!modal || modal.classList.contains('sdk-hidden')) return;

    if (e.key >= '1' && e.key <= '9') { onNumberInput(Number(e.key)); return; }
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { onErase(); return; }

    if (!state.selected) return;
    let [r, c] = state.selected;
    if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
    else if (e.key === 'ArrowDown') r = Math.min(8, r + 1);
    else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
    else if (e.key === 'ArrowRight') c = Math.min(8, c + 1);
    else return;
    e.preventDefault();
    state.selected = [r, c];
    renderBoard();
}

function openModal() {
    const modal = document.getElementById('sdk-modal');
    modal.classList.remove('sdk-hidden');
    if (!state.solution) startNewGame('easy');
}

function closeModal() {
    const modal = document.getElementById('sdk-modal');
    modal.classList.add('sdk-hidden');
}

// ─── ST Integration ──────────────────────────────────────────────────────────

const defaultSettings = { floating: true, pos: null };

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[extensionName]) extensionSettings[extensionName] = {};
    const s = extensionSettings[extensionName];
    for (const k in defaultSettings) {
        if (s[k] === undefined) s[k] = defaultSettings[k];
    }
    return s;
}

function saveSettings() {
    SillyTavern.getContext().saveSettingsDebounced();
}

// Пункт «Судоку» в волшебной палочке (меню расширений)
function injectMenuItem() {
    if (document.getElementById('sdk-menu-item')) return;
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return;
    const item = document.createElement('div');
    item.id = 'sdk-menu-item';
    item.className = 'list-group-item flex-container flexGap5';
    item.innerHTML = '<div class="fa-solid fa-table-cells extensionsMenuExtensionButton"></div><span>Судоку</span>';
    item.addEventListener('click', openModal);
    menu.appendChild(item);
}

// Плавающая кнопка на экране: перетаскивается, позиция запоминается
function applyFloating() {
    const s = getSettings();
    let btn = document.getElementById('sdk-fab');

    if (!s.floating) {
        if (btn) btn.remove();
        return;
    }
    if (btn) return;

    const SIZE = 44;
    btn = document.createElement('div');
    btn.id = 'sdk-fab';
    btn.title = 'Судоку';
    btn.textContent = '🔢';
    Object.assign(btn.style, {
        position: 'fixed',
        zIndex: '9000',
        width: SIZE + 'px',
        height: SIZE + 'px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        cursor: 'pointer',
        userSelect: 'none',
        touchAction: 'none',
        background: 'var(--SmartThemeBlurTintColor)',
        border: '1px solid var(--SmartThemeBorderColor)',
        boxShadow: '0 4px 14px #0006',
        backdropFilter: 'blur(8px)',
        webkitBackdropFilter: 'blur(8px)',
    });
    document.body.appendChild(btn);

    const place = (x, y) => {
        x = Math.min(Math.max(0, x), window.innerWidth - SIZE);
        y = Math.min(Math.max(0, y), window.innerHeight - SIZE);
        btn.style.left = x + 'px';
        btn.style.top = y + 'px';
    };

    const pos = s.pos || { x: window.innerWidth - SIZE - 12, y: window.innerHeight - 170 };
    place(pos.x, pos.y);
    window.addEventListener('resize', () => place(btn.offsetLeft, btn.offsetTop));

    let drag = null;
    btn.addEventListener('pointerdown', e => {
        drag = { sx: e.clientX, sy: e.clientY, bx: btn.offsetLeft, by: btn.offsetTop, moved: false };
        btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener('pointermove', e => {
        if (!drag) return;
        const dx = e.clientX - drag.sx;
        const dy = e.clientY - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
        if (drag.moved) place(drag.bx + dx, drag.by + dy);
    });
    btn.addEventListener('pointerup', () => {
        if (!drag) return;
        if (drag.moved) {
            getSettings().pos = { x: btn.offsetLeft, y: btn.offsetTop };
            saveSettings();
        } else {
            openModal();
        }
        drag = null;
    });
    btn.addEventListener('pointercancel', () => { drag = null; });
}

// Переключатель в настройках расширений
function addSettingsPanel() {
    if (document.getElementById('sdk-settings')) return;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.id = 'sdk-settings';
    wrap.className = 'extension_container';
    wrap.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Судоку</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label">
                    <input type="checkbox" id="sdk-float-toggle">
                    <span>Плавающая кнопка на экране</span>
                </label>
            </div>
        </div>
    `;
    host.appendChild(wrap);

    const cb = wrap.querySelector('#sdk-float-toggle');
    cb.checked = getSettings().floating;
    cb.addEventListener('change', () => {
        getSettings().floating = cb.checked;
        saveSettings();
        applyFloating();
    });
}

// ─── Init ────────────────────────────────────────────────────────────────────

jQuery(async () => {
    buildModal();
    injectMenuItem();
    addSettingsPanel();
    applyFloating();
    console.log(`[${extensionName}] loaded`);
});
