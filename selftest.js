// selftest.js — Вынесенный блок тестирования
const fakeDb = new Map();
const reply = data => ({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });

function fakeApi(path, opt = {}) {
    const [table, qs = ''] = path.split('?');
    const method = opt.method || 'GET';
    if (table === 'links') return Promise.resolve(reply([{ friend_id: 2 }, { friend_id: 3 }, { friend_id: 4 }]));
    if (method === 'POST') {
        const body = JSON.parse(opt.body || '[]');
        body.forEach(r => fakeDb.set(r.player_id, Object.assign({ progress: {}, inventory: [], stolen_bag: 0, name: '', avatar: '🦉', token: 't' + r.player_id, score: 0 }, fakeDb.get(r.player_id) || {}, r)));
        return Promise.resolve(reply(body));
    }
    if (method === 'DELETE') return Promise.resolve(reply({}));
    const rows = [...fakeDb.values()];
    const eq = qs.match(/player_id=eq\.(\d+)/);
    if (eq) return Promise.resolve(reply(rows.filter(r => r.player_id === +eq[1])));
    const inc = qs.match(/player_id=in\.\(([\d,]+)\)/);
    if (inc) { const set = inc[1].split(',').map(Number); return Promise.resolve(reply(rows.filter(r => set.includes(r.player_id)))); }
    return Promise.resolve(reply(rows));
}

window.runSelfTest = async () => {
    const snap = JSON.stringify(state), apiSnap = api, mySnap = myId, hostSnap = hostMode, viewSnap = viewId, cloudSnap = cloudReady;
    const metaSnap = JSON.stringify(meta), friendSnap = friendIds.slice(), rnd = Math.random;
    const results = [];
    const check = (name, cond, extra) => results.push((cond ? '✅ ' : '❌ ') + name + (extra ? ' — ' + extra : ''));
    
    window.__testMode = true; api = fakeApi; Math.random = () => 0.99;
    [1, 2, 3, 4].forEach(id => fakeDb.set(id, { player_id: id, name: 'P' + id, avatar: '🦊', token: 'tok' + id, score: 0, stolen_bag: 0, progress: {}, inventory: [] }));
    
    // ФИКС: принудительно делаем активным Игрока 1 перед началом теста
    myId = 1; hostMode = true; viewId = 0; state.p = 1;
    
    try {
        await bootSync(false);
        check('4 cards rendered', document.querySelectorAll('.player-card').length === 4, document.querySelectorAll('.player-card').length);
        
        const idx = allSectors.findIndex(s => s.id === 'read_select');
        state.prog[1] = {}; skills.forEach(s => state.prog[1][s.id] = 0); state.score[1] = 0;
        
        for (let i = 0; i < 6; i++) { 
            winIdx = idx; 
            showResult(allSectors[idx]); 
            btnAccept.click(); 
            btnFinish.click(); 
            closeModal(); 
        }
        
        check('progress stops at 6/6', state.prog[1].read_select === 6, 'progress=' + state.prog[1].read_select);
        check('XP 6×200 + 1000 mastery', state.score[1] === 2200, 'score=' + state.score[1]);
        
        selectPlayer(2);
        check('host can switch card', state.p === 2);
        
        hostMode = false; selectPlayer(3);
        check('someone else\'s card opens read-only', viewId === 3 && document.querySelector('.game-layout').classList.contains('watching'), 'viewId=' + viewId);
        check('progress panel visible while watching', getComputedStyle(document.querySelector('.right-panel')).display !== 'none');
        
        stopWatching();
        check('watch exit restores wheel', viewId === 0 && !document.querySelector('.game-layout').classList.contains('watching'));
        
        state.p = 2; state.score[2] = 500; state.score[3] = 777;
        openResetConfirm(); await confirmResetProgress();
        check('reset touches only active card', state.score[2] === 0 && state.score[3] === 777, 'p2=' + state.score[2] + ' p3=' + state.score[3]);
        check('modal closed after reset', !$('resetConfirmOverlay').classList.contains('active'));
        
    } catch (e) { 
        results.push('❌ crash: ' + e.message + '\n' + (e.stack || '').split('\n')[1]); 
    }
    
    // Восстанавливаем все как было
    state = JSON.parse(snap); api = apiSnap; myId = mySnap; hostMode = hostSnap; viewId = viewSnap; cloudReady = cloudSnap;
    Object.keys(meta).forEach(k => delete meta[k]); Object.assign(meta, JSON.parse(metaSnap)); friendIds = friendSnap;
    Math.random = rnd; window.__testMode = false;
    updateUI();

    const pass = results.every(r => r.startsWith('✅'));
    const text = '=== SELF-TEST ' + (pass ? 'PASS' : 'FAIL') + ' ===\n' + results.join('\n');
    console.log(text);
    showOverlay((pass ? '✅ SELF-TEST PASS' : '❌ SELF-TEST FAIL'), text, { ok: pass });
    return pass;
};