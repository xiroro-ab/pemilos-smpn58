const views = { login: document.getElementById('admin-login-view'), dashboard: document.getElementById('admin-dashboard-view') };
const tabs = { 
    dashboard: document.getElementById('tab-dashboard'), 
    settings: document.getElementById('tab-settings'),
    status: document.getElementById('tab-status'),
    live: document.getElementById('tab-live')
};
let liveInterval = null;
let globalVoters = [];

// Login Admin
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('admin-pwd').value;
    const btn = e.target.querySelector('button');
    btn.textContent = "Memverifikasi...";
    
    try {
        const res = await fetch('/api/admin/login', { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({password: pwd}) 
        });
        const data = await res.json();
        
        if (data.success) {
            views.login.classList.remove('active'); views.login.classList.add('hidden');
            views.dashboard.classList.remove('hidden'); views.dashboard.classList.add('active');
            initDashboard();
        } else {
            document.getElementById('admin-error').textContent = data.message;
            btn.textContent = "Masuk Dashboard";
        }
    } catch (err) {
        document.getElementById('admin-error').textContent = "Koneksi terputus";
        btn.textContent = "Masuk Dashboard";
    }
});

function switchTab(tabId, element) {
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    element.classList.add('active');
    
    Object.values(tabs).forEach(t => { t.classList.remove('active'); t.classList.add('hidden'); });
    tabs[tabId].classList.remove('hidden'); tabs[tabId].classList.add('active');
}

async function initDashboard() {
    await fetchDashboardData();
    liveInterval = setInterval(fetchDashboardData, 1500);
}

let highestVoteGlobal = 0;

async function fetchDashboardData() {
    try {
        const res = await fetch('/api/admin/dashboard');
        const { data } = await res.json();
        
        document.getElementById('stat-total').textContent = data.stats.total;
        document.getElementById('stat-voted').textContent = data.stats.voted;
        document.getElementById('stat-turnout').textContent = data.stats.turnout + '%';
        
        highestVoteGlobal = Math.max(...data.candidates.map(c => c.votes), 1); 
        
        updateRaceArena(data.candidates, data.stats.total);
        
        if (!document.activeElement.closest('.edit-form')) {
            renderSettings(data.candidates);
        }
        
        // Fetch voter list updates in background
        fetchVoterList();
    } catch (e) { console.error('Gagal mengambil data live'); }
}

function updateRaceArena(candidates, totalStudents = 1) {
    const arena = document.getElementById('race-arena');
    const validTotal = totalStudents > 0 ? totalStudents : 1;
    
    // Fungsi untuk warna dinamis berdasarkan persentase
    const getColor = (percent) => {
        if (percent < 25) return '#ef4444'; // Merah
        if (percent < 50) return '#f59e0b'; // Oranye
        if (percent < 75) return '#3b82f6'; // Biru
        return '#10b981'; // Hijau
    };
    
    if (arena.children.length === 0) {
        arena.innerHTML = '';
        candidates.forEach(c => {
            const rawPercent = (c.votes / validTotal) * 100;
            const heightPercent = c.votes === 0 ? 8 : Math.max(8, rawPercent);
            const barColor = getColor(rawPercent);
            
            arena.innerHTML += `
                <div class="pillar-container" id="pillar-cand-${c.id}">
                    <div class="pillar-bar-wrapper">
                        <div class="pillar-bar" id="bar-${c.id}" style="height: ${heightPercent}%; background-color: ${c.votes === 0 ? 'var(--border)' : barColor}">
                            <span id="score-${c.id}">${c.votes}</span>
                        </div>
                    </div>
                    <img src="${c.image}" class="pillar-avatar" id="avatar-arena-${c.id}" onerror="this.src='https://ui-avatars.com/api/?name=0${c.id}&background=1e293b&color=3b82f6&size=150&bold=true'">
                    <div class="pillar-name">Paslon 0${c.id}</div>
                </div>
            `;
        });
    } else {
        candidates.forEach(c => {
            const rawPercent = (c.votes / validTotal) * 100;
            const heightPercent = c.votes === 0 ? 8 : Math.max(8, rawPercent);
            const barColor = getColor(rawPercent);
            
            const bar = document.getElementById(`bar-${c.id}`);
            const score = document.getElementById(`score-${c.id}`);
            const avatar = document.getElementById(`avatar-arena-${c.id}`);
            
            if (bar && score) {
                bar.style.height = `${heightPercent}%`;
                bar.style.backgroundColor = c.votes === 0 ? 'var(--border)' : barColor;
                score.textContent = c.votes;
            }
            if (avatar && !avatar.src.includes(c.image)) {
                avatar.src = c.image;
            }
        });
    }
}

function renderSettings(candidates) {
    const container = document.getElementById('settings-candidates-list');
    if(container.children.length > 0) return;

    container.innerHTML = '';
    
    candidates.forEach(c => {
        const div = document.createElement('div');
        div.className = 'edit-card';
        div.innerHTML = `
            <img src="${c.image}" class="edit-img" id="preview-${c.id}" onerror="this.src='https://ui-avatars.com/api/?name=0${c.id}&background=1e293b&color=3b82f6&size=200&bold=true'">
            <div class="edit-form" id="form-cand-${c.id}">
                <label>Nama Kandidat 0${c.id}</label>
                <input type="text" id="name-${c.id}" value="${c.name}">
                
                <label>Upload Foto (Dari Komputer)</label>
                <div class="file-upload-wrapper">
                    <label class="btn-upload" for="file-${c.id}">📂 Pilih Foto Lokal...</label>
                    <input type="file" id="file-${c.id}" accept="image/png, image/jpeg, image/webp" onchange="previewFile(${c.id})">
                    <span class="file-name-display" id="filename-${c.id}">Pilih gambar (.jpg / .png)</span>
                </div>
                
                <label>Visi & Misi</label>
                <textarea id="vision-${c.id}" rows="3">${c.vision}</textarea>
                
                <button class="btn btn-save" onclick="saveCandidate(${c.id})">Simpan Data & Foto</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function previewFile(id) {
    const fileInput = document.getElementById(`file-${id}`);
    const nameDisplay = document.getElementById(`filename-${id}`);
    const previewImg = document.getElementById(`preview-${id}`);
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        nameDisplay.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = (e) => { previewImg.src = e.target.result; };
        reader.readAsDataURL(file);
    }
}

async function saveCandidate(id) {
    const name = document.getElementById(`name-${id}`).value;
    const vision = document.getElementById(`vision-${id}`).value;
    const previewImg = document.getElementById(`preview-${id}`);
    
    const btn = document.querySelector(`#form-cand-${id} .btn-save`);
    btn.textContent = "Mengunggah...";
    
    // Ambil base64 dari tag img
    const imageBase64 = previewImg.src;
    
    try {
        const res = await fetch('/api/admin/update-candidate', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, vision, image: imageBase64 })
        });
        const data = await res.json();
        if(data.success) {
            btn.textContent = "Data Tersimpan ✅";
            setTimeout(() => btn.textContent = "Simpan Data & Foto", 2000);
            fetchDashboardData(); 
        } else {
            throw new Error(data.message);
        }
    } catch(err) {
        console.error(err);
        btn.textContent = "❌ Gagal Menyimpan";
        setTimeout(() => btn.textContent = "Simpan Data & Foto", 2000);
    }
}

/* --- LOGIKA DATABASE CSV IMPORT --- */
let parsedStudents = [];

function previewCSV() {
    const fileInput = document.getElementById('csv-file');
    const nameDisplay = document.getElementById('csv-filename');
    const previewContainer = document.getElementById('csv-preview-container');
    const previewBody = document.getElementById('csv-preview-body');
    const importBtn = document.getElementById('btn-import-csv');
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        nameDisplay.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            // Parse CSV secara manual untuk kompatibilitas luas
            const lines = text.split(/\r?\n/);
            parsedStudents = [];
            previewBody.innerHTML = '';
            
            // Lewati baris 1 (Header), baca baris data
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const parts = line.split(/[,;]/); // Support CSV standar & format eropa (titik koma)
                if (parts.length >= 3) {
                    const nisn = parts[0].trim().replace(/['"]/g, '');
                    const name = parts[1].trim().replace(/['"]/g, '');
                    const kelas = parts[2].trim().replace(/['"]/g, '');
                    
                    if(nisn && name && kelas) {
                        parsedStudents.push({ nisn, name, kelas });
                        
                        // Tampilkan preview 5 baris pertama saja agar tidak berat
                        if (parsedStudents.length <= 5) {
                            previewBody.innerHTML += `<tr><td>${nisn}</td><td>${name}</td><td>${kelas}</td></tr>`;
                        }
                    }
                }
            }
            
            if (parsedStudents.length > 0) {
                previewContainer.classList.remove('hidden');
                importBtn.style.display = 'block';
                importBtn.textContent = `Mulai Sinkronisasi ${parsedStudents.length} Data Pemilih`;
            } else {
                showCustomAlert("Format Salah", "Data kosong atau format salah. Pastikan menggunakan Template CSV resmi (3 Kolom).", true);
            }
        };
        reader.readAsText(file);
    }
}

function cancelImport() {
    document.getElementById('csv-file').value = '';
    document.getElementById('csv-filename').textContent = 'file.csv';
    document.getElementById('csv-preview-container').classList.add('hidden');
    document.getElementById('btn-import-csv').style.display = 'none';
    parsedStudents = [];
}

async function importCSV() {
    if (parsedStudents.length === 0) return;
    
    const btn = document.getElementById('btn-import-csv');
    btn.textContent = "Sedang Memproses Ribuan Data...";
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/admin/import-students', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ students: parsedStudents })
        });
        
        const data = await res.json();
        if (data.success) {
            showCustomAlert("Berhasil", data.message);
            
            // Reset UI form CSV
            document.getElementById('csv-file').value = '';
            document.getElementById('csv-filename').textContent = 'Belum ada file dipilih';
            document.getElementById('csv-preview-container').classList.add('hidden');
            btn.style.display = 'none';
            btn.disabled = false;
            parsedStudents = [];
            
            fetchDashboardData();
        } else {
            showCustomAlert("Gagal Import", data.message, true);
            btn.disabled = false;
        }
    } catch(err) {
        showCustomAlert("Kesalahan Jaringan", "Terjadi kesalahan jaringan saat mengimpor.", true);
        btn.disabled = false;
    }
}

/* --- LOGIKA STATUS PEMILIH --- */
async function fetchVoterList() {
    try {
        const res = await fetch('/api/admin/voters');
        const data = await res.json();
        if (data.success) {
            globalVoters = data.data;
            renderVoterList();
            renderLiveFeed();
        }
    } catch(err) {
        console.error("Gagal mengambil status pemilih");
    }
}

function renderLiveFeed() {
    const votedList = document.getElementById('live-voted-list');
    const pendingList = document.getElementById('live-pending-list');
    if (!votedList || !pendingList) return;
    
    // Jangan perbarui DOM jika tab live tidak aktif (hemat kinerja)
    if (!document.getElementById('tab-live').classList.contains('active')) return;
    
    const voted = globalVoters.filter(v => v.hasVoted);
    const pending = globalVoters.filter(v => !v.hasVoted);
    
    document.getElementById('live-voted-count').textContent = voted.length;
    document.getElementById('live-pending-count').textContent = pending.length;
    
    const buildHTML = (items) => {
        if(items.length === 0) return '<p style="color:var(--text-muted); text-align:center; padding:20px;">Belum ada data</p>';
        let h = '';
        items.forEach(v => {
            h += `<div style="padding:15px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; background:rgba(255,255,255,0.02); border-radius:8px; margin-bottom:8px;">
                <strong>${v.name}</strong> <span style="color:var(--text-muted); font-size:0.85rem;">${v.kelas || '-'}</span>
            </div>`;
        });
        return items.length > 5 ? h + h : h; 
    };
    
    votedList.innerHTML = buildHTML(voted);
    votedList.style.animation = voted.length > 5 ? `scrollUp ${Math.max(voted.length * 2, 20)}s linear infinite` : 'none';
    
    pendingList.innerHTML = buildHTML(pending);
    pendingList.style.animation = pending.length > 5 ? `scrollUp ${Math.max(pending.length * 2, 20)}s linear infinite` : 'none';
}

function populateClassFilter() {
    const classFilter = document.getElementById('class-filter');
    if(!classFilter) return;
    
    // Get unique classes
    const classes = [...new Set(globalVoters.map(v => v.kelas))].filter(Boolean).sort();
    
    // Simpan value saat ini agar tidak kereset saat live update
    const currentValue = classFilter.value;
    
    let html = '<option value="all">Semua Kelas</option>';
    classes.forEach(c => {
        html += `<option value="${c}">${c}</option>`;
    });
    
    classFilter.innerHTML = html;
    
    // Kembalikan value sebelumnya jika masih ada di daftar
    if (classes.includes(currentValue) || currentValue === 'all') {
        classFilter.value = currentValue;
    }
}

function renderVoterList() {
    const tbody = document.getElementById('voter-list-body');
    const filter = document.getElementById('voter-filter');
    const classFilter = document.getElementById('class-filter');
    
    if(!tbody || !filter || !classFilter) return;
    
    // Pastikan filter terisi dengan kelas terbaru
    if (document.activeElement !== classFilter) {
        populateClassFilter();
    }
    
    const filterValue = filter.value;
    const classValue = classFilter.value;
    
    let filtered = globalVoters;
    
    // Filter Kelas
    if (classValue !== 'all') {
        filtered = filtered.filter(v => v.kelas === classValue);
    }
    
    // Filter Status
    if (filterValue === 'voted') filtered = filtered.filter(v => v.hasVoted);
    if (filterValue === 'not_voted') filtered = filtered.filter(v => !v.hasVoted);
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748B;">Tidak ada data pemilih.</td></tr>`;
        return;
    }
    
    // Buat HTML string
    let html = '';
    filtered.forEach(v => {
        const statusHTML = v.hasVoted 
            ? `<span style="color:var(--success); font-weight:600;">🟢 Sudah Memilih</span>` 
            : `<span style="color:#DC2626; font-weight:600;">🔴 Belum Memilih</span>`;
            
        const safeName = (v.name || '').replace(/'/g, "\\'");
        const safeKelas = (v.kelas || '').replace(/'/g, "\\'");
        
        html += `
            <tr>
                <td>${v.nisn || '-'}</td>
                <td style="font-weight:500;">${v.name || '-'}</td>
                <td>${v.kelas || '-'}</td>
                <td>${statusHTML}</td>
                <td>
                    <button class="btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="openEditVoterModal('${v.nisn}', '${safeName}', '${safeKelas}')">Edit</button>
                    <button class="btn-outline" style="padding:4px 8px; font-size:0.75rem; color:#ef4444; border-color:rgba(239,68,68,0.3);" onclick="deleteVoter('${v.nisn}')">Hapus</button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// --- CRUD Votter Logic ---
function openAddVoterModal() {
    document.getElementById('voter-modal-title').textContent = 'Tambah Pemilih Baru';
    document.getElementById('voter-old-nisn').value = '';
    document.getElementById('voter-nisn').value = '';
    document.getElementById('voter-name').value = '';
    document.getElementById('voter-kelas').value = '';
    document.getElementById('voter-modal').classList.remove('hidden');
}

function openEditVoterModal(nisn, name, kelas) {
    document.getElementById('voter-modal-title').textContent = 'Edit Data Pemilih';
    document.getElementById('voter-old-nisn').value = nisn;
    document.getElementById('voter-nisn').value = nisn;
    document.getElementById('voter-name').value = name;
    document.getElementById('voter-kelas').value = kelas;
    document.getElementById('voter-modal').classList.remove('hidden');
}

function closeVoterModal() {
    document.getElementById('voter-modal').classList.add('hidden');
}

async function saveVoter() {
    const oldNisn = document.getElementById('voter-old-nisn').value;
    const nisn = document.getElementById('voter-nisn').value.trim();
    const name = document.getElementById('voter-name').value.trim();
    const kelas = document.getElementById('voter-kelas').value.trim();
    
    if (!nisn || !name || !kelas) {
        return showCustomAlert('Data Tidak Lengkap', 'Semua kolom harus diisi!', true);
    }
    
    const isEdit = !!oldNisn;
    const url = isEdit ? `/api/admin/edit-voter/${oldNisn}` : `/api/admin/add-voter`;
    const method = isEdit ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nisn, name, kelas })
        });
        const data = await res.json();
        if (data.success) {
            closeVoterModal();
            showCustomAlert('Berhasil', data.message);
            fetchDashboardData();
        } else {
            showCustomAlert('Gagal', data.message, true);
        }
    } catch(err) {
        showCustomAlert('Kesalahan', 'Gagal menghubungi server.', true);
    }
}

function deleteVoter(nisn) {
    showCustomConfirm('Hapus Pemilih?', `Yakin ingin menghapus pemilih dengan ID: ${nisn}? Data yang dihapus tidak bisa dikembalikan.`, async (confirmed) => {
        if (!confirmed) return;
        try {
            const res = await fetch(`/api/admin/delete-voter/${nisn}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchDashboardData();
            } else {
                showCustomAlert('Gagal', data.message, true);
            }
        } catch(err) {
            showCustomAlert('Kesalahan', 'Gagal menghubungi server.', true);
        }
    });
}

// --- Custom Modal System ---
let modalCallback = null;
function showCustomAlert(title, message, isError = false) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    const iconHtml = isError 
        ? `<svg width="48" height="48" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
        : `<svg width="48" height="48" fill="none" stroke="#10b981" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
    document.getElementById('modal-icon').innerHTML = iconHtml;
    document.getElementById('modal-btn-cancel').classList.add('hidden');
    document.getElementById('custom-modal').classList.remove('hidden');
    modalCallback = null;
}
function showCustomConfirm(title, message, callback) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-icon').innerHTML = `<svg width="48" height="48" fill="none" stroke="#f59e0b" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    document.getElementById('modal-btn-cancel').classList.remove('hidden');
    document.getElementById('custom-modal').classList.remove('hidden');
    modalCallback = callback;
}
window.closeCustomModal = function(isConfirm) {
    document.getElementById('custom-modal').classList.add('hidden');
    if (modalCallback) {
        modalCallback(isConfirm);
        modalCallback = null;
    }
}

// Toggle Sidebar Mobile
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

function cancelImport() {
    parsedStudents = [];
    document.getElementById('csv-file').value = '';
    document.getElementById('csv-filename').textContent = 'Belum ada file dipilih';
    document.getElementById('csv-preview-container').classList.add('hidden');
}
