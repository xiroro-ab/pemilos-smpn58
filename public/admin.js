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
        globalCandidates = data.candidates;
        
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
                        <div class="pillar-score" id="score-${c.id}">${c.votes}</div>
                        <div class="pillar-bar" id="bar-${c.id}" style="height: ${heightPercent}%; background-color: ${c.votes === 0 ? 'var(--border)' : barColor}"></div>
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
                
                <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;">
                <label>URL Video YouTube (Opsional, untuk Live Feed)</label>
                <input type="url" id="video-${c.id}" value="${c.vision_video_url || ''}" placeholder="https://www.youtube.com/watch?v=...">
                
                <label>Atau Upload Poster Kampanye (Opsional)</label>
                <div class="file-upload-wrapper">
                    <label class="btn-upload" for="poster-${c.id}">📂 Pilih Poster...</label>
                    <input type="file" id="poster-${c.id}" accept="image/png, image/jpeg, image/webp" onchange="previewPoster(${c.id})">
                    <span class="file-name-display" id="poster-filename-${c.id}">Pilih gambar (.jpg / .png)</span>
                </div>
                <!-- Poster Preview (Hidden initially) -->
                <img src="${c.vision_poster || ''}" id="poster-preview-${c.id}" style="max-width: 100%; border-radius: 8px; margin-bottom: 15px; display: ${c.vision_poster ? 'block' : 'none'};">
                
                <button class="btn btn-save" onclick="saveCandidate(${c.id})">Simpan Semua Perubahan</button>
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
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 600; // Avatars can be smaller
                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                previewImg.src = canvas.toDataURL('image/jpeg', 0.6);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function previewPoster(id) {
    const fileInput = document.getElementById(`poster-${id}`);
    const nameDisplay = document.getElementById(`poster-filename-${id}`);
    const previewImg = document.getElementById(`poster-preview-${id}`);
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        nameDisplay.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                // Max width/height 1200px
                const MAX_SIZE = 1200;
                if (width > height && width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to JPEG with 0.6 quality (reduces size drastically)
                previewImg.src = canvas.toDataURL('image/jpeg', 0.6);
                previewImg.style.display = 'block';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function saveCandidate(id) {
    const name = document.getElementById(`name-${id}`).value;
    const vision = document.getElementById(`vision-${id}`).value;
    const videoUrl = document.getElementById(`video-${id}`).value;
    const previewImg = document.getElementById(`preview-${id}`);
    const posterImg = document.getElementById(`poster-preview-${id}`);
    
    const btn = document.querySelector(`#form-cand-${id} .btn-save`);
    btn.textContent = "Mengunggah...";
    
    // Ambil base64 dari tag img
    const imageBase64 = previewImg.src;
    const posterBase64 = posterImg.style.display !== 'none' ? posterImg.src : null;
    
    try {
        const res = await fetch('/api/admin/update-candidate', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, vision, image: imageBase64, visionVideoUrl: videoUrl, visionPoster: posterBase64 })
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

let lastSeenActivityId = 0;
let isCarouselRunning = false;
let currentCarouselIndex = 0;

async function renderLiveFeed() {
    const track = document.getElementById('live-activities-track');
    if (!track) return;
    
    // Jangan perbarui DOM jika tab live tidak aktif (hemat kinerja)
    if (!document.getElementById('tab-live').classList.contains('active')) {
        return;
    }
    
    // Start carousel if not started
    if (!isCarouselRunning && globalCandidates.length > 0) {
        isCarouselRunning = true;
        updateCarousel();
    }
    
    try {
        const res = await fetch('/api/admin/activities');
        const data = await res.json();
        
        if (data.success && data.data.length > 0) {
            // Urutkan ascending agar yang tertua dari batch baru diproses dulu
            const newActivities = data.data.filter(a => a.id > lastSeenActivityId).sort((a,b) => a.id - b.id);
            
            newActivities.forEach((act) => {
                lastSeenActivityId = Math.max(lastSeenActivityId, act.id);
                
                const time = new Date(act.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                
                const item = document.createElement('div');
                item.className = 'danmaku-item';
                
                // Posisi Y Acak antara 10% dan 80%
                const topPos = Math.floor(Math.random() * 70) + 10;
                item.style.top = `${topPos}%`;
                
                // Durasi animasi acak agar bervariasi (12s - 18s)
                const duration = Math.floor(Math.random() * 4) + 8;
                item.style.animationDuration = `${duration}s`;
                
                if (act.action === 'LOGIN') {
                    item.style.borderColor = '#3b82f6';
                    item.innerHTML = `
                        <span style="font-size: 2rem;">👋</span>
                        <div>
                            <strong style="font-size: 1.2rem; color: #60a5fa;">${act.student_name}</strong>
                            <span style="color: white; font-size: 1.1rem;"> baru saja memasuki bilik suara!</span>
                        </div>
                        <span style="margin-left: 10px; color: var(--text-muted); font-size: 0.9rem;">${time}</span>
                    `;
                } else if (act.action === 'VOTE') {
                    item.style.borderColor = '#10b981';
                    item.innerHTML = `
                        <span style="font-size: 2rem;">🗳️</span>
                        <div>
                            <strong style="font-size: 1.2rem; color: #34d399;">${act.student_name}</strong>
                            <span style="color: white; font-size: 1.1rem;"> resmi menggunakan hak pilihnya!</span>
                        </div>
                        <span style="margin-left: 10px; color: var(--text-muted); font-size: 0.9rem;">${time}</span>
                    `;
                }
                
                track.appendChild(item);
                
                // Hapus elemen dari DOM setelah animasi selesai
                setTimeout(() => {
                    if (item.parentNode) item.parentNode.removeChild(item);
                }, duration * 1000);
            });
        }
    } catch(err) {
        console.error("Gagal mengambil live feed");
    }
}

let ytPlayer = null;
let carouselTimeout = null;

function updateCarousel() {
    const bgContainer = document.getElementById('live-carousel-bg');
    const contentContainer = document.getElementById('live-carousel-content');
    if (!bgContainer || !contentContainer || globalCandidates.length === 0) return;
    
    // Bersihkan timeout sebelumnya
    if (carouselTimeout) clearTimeout(carouselTimeout);
    
    const c = globalCandidates[currentCarouselIndex];
    
    // Fade out
    bgContainer.style.opacity = '0';
    
    setTimeout(() => {
        let contentHTML = '';
        let displayDuration = 10000; // Default 10 detik
        
        // 1. Cek apakah ada Video YouTube
        if (c.vision_video_url && c.vision_video_url.includes('youtu')) {
            // Ekstrak ID YouTube (support youtu.be dan youtube.com)
            let videoId = '';
            if (c.vision_video_url.includes('youtu.be/')) {
                videoId = c.vision_video_url.split('youtu.be/')[1].split('?')[0];
            } else if (c.vision_video_url.includes('v=')) {
                videoId = c.vision_video_url.split('v=')[1].split('&')[0];
            }
            
            if (videoId) {
                // Tampilkan Iframe Player
                contentHTML = `
                    <div style="width: 800px; max-width: 90vw; border-radius: 20px; overflow: hidden; border: 4px solid var(--primary); box-shadow: 0 0 40px rgba(79, 70, 229, 0.4); background: black;">
                        <div id="yt-player-container"></div>
                    </div>
                `;
                
                contentContainer.innerHTML = contentHTML;
                bgContainer.style.opacity = '0.9'; // Lebih jelas untuk video
                
                // Inisialisasi Player
                if (window.YT && window.YT.Player) {
                    ytPlayer = new YT.Player('yt-player-container', {
                        height: '450',
                        width: '100%',
                        videoId: videoId,
                        playerVars: {
                            'autoplay': 1,
                            'controls': 0,
                            'rel': 0,
                            'showinfo': 0,
                            'mute': 0,
                            'modestbranding': 1
                        },
                        events: {
                            'onStateChange': function(event) {
                                // Jika video selesai (State 0) atau error, lanjut ke paslon berikutnya
                                if (event.data === YT.PlayerState.ENDED) {
                                    currentCarouselIndex = (currentCarouselIndex + 1) % globalCandidates.length;
                                    updateCarousel();
                                }
                            },
                            'onError': function(event) {
                                currentCarouselIndex = (currentCarouselIndex + 1) % globalCandidates.length;
                                updateCarousel();
                            }
                        }
                    });
                } else {
                    // Fallback jika API YT belum load
                    contentContainer.innerHTML = `
                        <iframe width="800" height="450" src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 20px; border: 4px solid var(--primary);"></iframe>
                    `;
                    displayDuration = 60000; // Set 60 detik fallback
                    carouselTimeout = setTimeout(() => {
                        currentCarouselIndex = (currentCarouselIndex + 1) % globalCandidates.length;
                        updateCarousel();
                    }, displayDuration);
                }
                
                return; // Jangan lanjutkan ke logika gambar
            }
        }
        
        // 2. Cek apakah ada Poster
        if (c.vision_poster && c.vision_poster.length > 100) {
            contentHTML = `
                <img src="${c.vision_poster}" style="width: 800px; max-width: 90vw; border-radius: 20px; object-fit: contain; border: 4px solid var(--primary); margin-bottom: 20px; box-shadow: 0 0 40px rgba(79, 70, 229, 0.4); max-height: 70vh;">
            `;
            displayDuration = 10000; // 10 detik untuk poster
            bgContainer.style.opacity = '0.7';
        } else {
            // 3. Fallback ke Tampilan Standar
            contentHTML = `
                <img src="${c.image}" onerror="this.src='https://ui-avatars.com/api/?name=0${c.id}&background=1e293b&color=3b82f6&size=250&bold=true'" style="width: 250px; height: 250px; border-radius: 50%; object-fit: cover; border: 4px solid var(--primary); margin-bottom: 20px; box-shadow: 0 0 40px rgba(79, 70, 229, 0.4);">
                <h2 style="font-size: 3rem; color: white; margin-bottom: 15px; text-shadow: 0 0 20px rgba(0,0,0,0.8);">Paslon 0${c.id}: ${c.name}</h2>
                <p style="font-size: 1.5rem; color: var(--text-muted); max-width: 800px; margin: 0 auto; line-height: 1.6; font-style: italic;">"${c.vision}"</p>
            `;
            displayDuration = 30000; // 30 detik untuk teks standar
            bgContainer.style.opacity = '0.7';
        }
        
        contentContainer.innerHTML = contentHTML;
        
        carouselTimeout = setTimeout(() => {
            currentCarouselIndex = (currentCarouselIndex + 1) % globalCandidates.length;
            updateCarousel();
        }, displayDuration);
        
    }, 1000);
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
