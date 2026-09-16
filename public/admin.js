const views = { login: document.getElementById('admin-login-view'), dashboard: document.getElementById('admin-dashboard-view') };
const tabs = { 
    dashboard: document.getElementById('tab-dashboard'), 
    settings: document.getElementById('tab-settings'),
    status: document.getElementById('tab-status'),
    schedule: document.getElementById('tab-schedule'),
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
    await loadSchedules();
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
            // Gunakan kurva akar kuadrat agar perbedaan kecil di awal (1 vs 2 vote) terlihat jelas secara visual
            const curveFactor = Math.sqrt(rawPercent / 100);
            const heightPercent = c.votes === 0 ? 8 : 8 + (curveFactor * 92);
            const barColor = getColor(rawPercent);
            
            arena.innerHTML += `
                <div class="pillar-container" id="pillar-cand-${c.id}">
                    <div class="pillar-bar-wrapper">
                        <div class="pillar-score" id="score-${c.id}">${c.votes}</div>
                        <div class="pillar-bar" id="bar-${c.id}" style="height: ${heightPercent}%; background-color: ${c.votes === 0 ? 'var(--border)' : barColor}"></div>
                    </div>
                    <img src="${c.image}" class="pillar-avatar" id="avatar-arena-${c.id}" onerror="this.src='https://ui-avatars.com/api/?name=0${c.id}&background=1e293b&color=3b82f6&size=150&bold=true'">
                    <div class="pillar-name"><small style="color: var(--text-muted); font-size: 0.72rem; line-height: 1;">Paslon 0${c.id}</small><span style="display:block; line-height: 1.2; margin-top: 1px;">${c.name}</span></div>
                </div>
            `;
        });
    } else {
        candidates.forEach(c => {
            const rawPercent = (c.votes / validTotal) * 100;
            const curveFactor = Math.sqrt(rawPercent / 100);
            const heightPercent = c.votes === 0 ? 8 : 8 + (curveFactor * 92);
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
                <button type="button" style="background:none; border:1px solid #ef4444; color:#ef4444; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; margin-top:5px;" onclick="removePhoto(${c.id})">🗑️ Hapus Foto</button>
                
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
                <button type="button" style="background:none; border:1px solid #ef4444; color:#ef4444; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; margin-bottom:15px;" onclick="removePoster(${c.id})">🗑️ Hapus Poster</button>
                
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

async function removePhoto(id) {
    showCustomConfirm('Hapus Foto?', 'Apakah Anda yakin ingin menghapus foto paslon ini?', async (confirmed) => {
        if (!confirmed) return;
        
        try {
            const defaultImg = `https://ui-avatars.com/api/?name=Paslon+0${id}&background=1e293b&color=3b82f6&size=200&bold=true`;
            const res = await fetch('/api/admin/update-candidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, image: defaultImg })
            });
            
            const data = await res.json();
            if (data.success) {
                document.getElementById(`preview-${id}`).src = defaultImg;
                document.getElementById(`filename-${id}`).textContent = 'Pilih gambar (.jpg / .png)';
                showCustomAlert('Berhasil', 'Foto berhasil dihapus', false);
            } else {
                showCustomAlert('Error', 'Gagal menghapus foto', true);
            }
        } catch (error) {
            showCustomAlert('Error', 'Gagal menghapus foto', true);
        }
    });
}

async function removePoster(id) {
    showCustomConfirm('Hapus Poster?', 'Apakah Anda yakin ingin menghapus poster kampanye ini?', async (confirmed) => {
        if (!confirmed) return;
        
        try {
            const res = await fetch('/api/admin/update-candidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, visionPoster: null })
            });
            
            const data = await res.json();
            if (data.success) {
                const posterPreview = document.getElementById(`poster-preview-${id}`);
                if (posterPreview) {
                    posterPreview.src = '';
                    posterPreview.style.display = 'none';
                }
                showCustomAlert('Berhasil', 'Poster berhasil dihapus', false);
            } else {
                showCustomAlert('Error', 'Gagal menghapus poster', true);
            }
        } catch (error) {
            showCustomAlert('Error', 'Gagal menghapus poster', true);
        }
    });
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
        buildCarouselQueue();
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
                        <span style="font-size: 1.2rem;">👋</span>
                        <div>
                            <strong style="font-size: 0.9rem; color: #60a5fa;">${act.student_name}</strong>
                            <span style="color: white; font-size: 0.85rem;"> baru saja memasuki bilik suara!</span>
                        </div>
                        <span style="margin-left: 6px; color: var(--text-muted); font-size: 0.75rem;">${time}</span>
                    `;
                } else if (act.action === 'VOTE') {
                    item.style.borderColor = '#10b981';
                    item.innerHTML = `
                        <span style="font-size: 1.2rem;">🗳️</span>
                        <div>
                            <strong style="font-size: 0.9rem; color: #34d399;">${act.student_name}</strong>
                            <span style="color: white; font-size: 0.85rem;"> resmi menggunakan hak pilihnya!</span>
                        </div>
                        <span style="margin-left: 6px; color: var(--text-muted); font-size: 0.75rem;">${time}</span>
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
let carouselQueue = [];
let currentQueueIndex = 0;

function buildCarouselQueue() {
    carouselQueue = [];
    globalCandidates.forEach(c => {
        if (c.vision_poster && c.vision_poster.length > 100) {
            carouselQueue.push({ type: 'poster', candidate: c });
        }
        if (c.vision_video_url && c.vision_video_url.includes('youtu')) {
            carouselQueue.push({ type: 'video', candidate: c });
        }
        if (!c.vision_poster || c.vision_poster.length <= 100) {
            if (!c.vision_video_url || !c.vision_video_url.includes('youtu')) {
                carouselQueue.push({ type: 'text', candidate: c });
            }
        }
    });
    if (carouselQueue.length === 0) {
        globalCandidates.forEach(c => {
            carouselQueue.push({ type: 'text', candidate: c });
        });
    }
    currentQueueIndex = 0;
}

function updateCarousel() {
    const bgContainer = document.getElementById('live-carousel-bg');
    const contentContainer = document.getElementById('live-carousel-content');
    if (!bgContainer || !contentContainer || carouselQueue.length === 0) return;
    
    if (carouselTimeout) clearTimeout(carouselTimeout);
    
    const item = carouselQueue[currentQueueIndex];
    const c = item.candidate;
    
    bgContainer.style.opacity = '0';
    
    setTimeout(() => {
        let contentHTML = '';
        let displayDuration = 10000;
        
        if (item.type === 'video') {
            let videoId = '';
            if (c.vision_video_url.includes('youtube.com/shorts/')) {
                videoId = c.vision_video_url.split('youtube.com/shorts/')[1].split('?')[0].split('&')[0];
            } else if (c.vision_video_url.includes('youtu.be/')) {
                videoId = c.vision_video_url.split('youtu.be/')[1].split('?')[0];
            } else if (c.vision_video_url.includes('v=')) {
                videoId = c.vision_video_url.split('v=')[1].split('&')[0];
            }
            
            if (videoId) {
                contentHTML = `
                    <div style="width: 800px; max-width: 90vw; border-radius: 20px; overflow: hidden; border: 4px solid var(--primary); box-shadow: 0 0 40px rgba(79, 70, 229, 0.4); background: black;">
                        <div id="yt-player-container"></div>
                    </div>
                `;
                
                contentContainer.innerHTML = contentHTML;
                bgContainer.style.opacity = '0.9';
                
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
                                if (event.data === YT.PlayerState.ENDED) {
                                    currentQueueIndex = (currentQueueIndex + 1) % carouselQueue.length;
                                    updateCarousel();
                                }
                            },
                            'onError': function(event) {
                                currentQueueIndex = (currentQueueIndex + 1) % carouselQueue.length;
                                updateCarousel();
                            }
                        }
                    });
                } else {
                    contentContainer.innerHTML = `
                        <iframe width="800" height="450" src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius: 20px; border: 4px solid var(--primary);"></iframe>
                    `;
                    displayDuration = 180000;
                    carouselTimeout = setTimeout(() => {
                        currentQueueIndex = (currentQueueIndex + 1) % carouselQueue.length;
                        updateCarousel();
                    }, displayDuration);
                }
                
            } else {
                currentQueueIndex = (currentQueueIndex + 1) % carouselQueue.length;
                updateCarousel();
            }
            return;
        }
        
        if (item.type === 'poster') {
            contentHTML = `
                <img src="${c.vision_poster}" style="width: 800px; max-width: 90vw; border-radius: 20px; object-fit: contain; border: 4px solid var(--primary); margin-bottom: 20px; box-shadow: 0 0 40px rgba(79, 70, 229, 0.4); max-height: 70vh;">
            `;
            displayDuration = 10000;
            bgContainer.style.opacity = '0.7';
        } else {
            contentHTML = `
                <img src="${c.image}" onerror="this.src='https://ui-avatars.com/api/?name=0${c.id}&background=1e293b&color=3b82f6&size=250&bold=true'" style="width: 250px; height: 250px; border-radius: 50%; object-fit: cover; border: 4px solid var(--primary); margin-bottom: 20px; box-shadow: 0 0 40px rgba(79, 70, 229, 0.4);">
                <h2 style="font-size: 3rem; color: white; margin-bottom: 15px; text-shadow: 0 0 20px rgba(0,0,0,0.8);">Paslon 0${c.id}: ${c.name}</h2>
                <p style="font-size: 1.5rem; color: var(--text-muted); max-width: 800px; margin: 0 auto; line-height: 1.6; font-style: italic;">"${c.vision}"</p>
            `;
            displayDuration = 30000;
            bgContainer.style.opacity = '0.7';
        }
        
        contentContainer.innerHTML = contentHTML;
        
        carouselTimeout = setTimeout(() => {
            currentQueueIndex = (currentQueueIndex + 1) % carouselQueue.length;
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

function confirmDeleteAllVoters() {
    showCustomConfirm(
        '🗑️ HAPUS SEMUA DATA PEMILIH?',
        'TINDAKAN INI TIDAK BISA DIBATALKAN!\n\nSemua data pemilih akan dihapus dari database.\nProses ini akan menghapus:\n- ID Pemilih (NISN)\n- Nama Pemilih\n- Kelas\n- Status Pemilihan\n\nApakah Anda YAKIN ingin menghapus SEMUA data pemilih?',
        (confirmed) => {
            if (!confirmed) return;
            
            showCustomPrompt(
                'Konfirmasi Terakhir',
                'Ketik "HAPUS SEMUA" (tanpa tanda kutip) untuk mengeksekusi penghapusan:',
                async (inputValue) => {
                    if (inputValue !== 'HAPUS SEMUA') {
                        showCustomAlert('Dibatalkan', 'Proses penghapusan dibatalkan karena kata kunci salah.');
                        return;
                    }
                    
                    try {
                        const res = await fetch('/api/admin/delete-all-voters', { method: 'POST' });
                        const data = await res.json();
                        
                        if (data.success) {
                            showCustomAlert('Berhasil', 'Semua data pemilih telah dihapus.', false);
                            globalVoters = [];
                            renderVoterList();
                        } else {
                            showCustomAlert('Gagal', data.message, true);
                        }
                    } catch(err) {
                        showCustomAlert('Kesalahan', 'Gagal menghubungi server.', true);
                    }
                }
            );
        }
    );
}

function confirmResetDatabase() {
    showCustomConfirm(
        '⚠️ RESET DATABASE UNTUK HARI-H?', 
        'TINDAKAN INI SANGAT BERBAHAYA!\n\nSemua suara kandidat akan dikembalikan menjadi 0.\nStatus semua siswa akan di-reset menjadi BELUM MEMILIH.\nLog aktivitas akan dihapus sepenuhnya.\n\nApakah Anda YAKIN 100% ingin mereset database untuk Hari-H Pemilos?', 
        (confirmed) => {
            if (!confirmed) return;
            
            // Double confirmation via custom prompt
            showCustomPrompt(
                'Konfirmasi Terakhir',
                'Ketik "RESET" (tanpa tanda kutip) huruf besar semua untuk mengeksekusi reset:',
                async (inputValue) => {
                    if (inputValue !== 'RESET') {
                        showCustomAlert('Dibatalkan', 'Proses reset dibatalkan karena kata kunci salah.');
                        return;
                    }
                    
                    try {
                        const res = await fetch('/api/admin/reset-database', { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                            showCustomAlert('Sukses Besar!', data.message);
                            fetchDashboardData(); // Refresh UI
                        } else {
                            showCustomAlert('Gagal', data.message, true);
                        }
                    } catch(err) {
                        showCustomAlert('Kesalahan', 'Gagal menghubungi server. Periksa koneksi internet.', true);
                    }
                }
            );
        }
    );
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
    document.getElementById('modal-input').classList.add('hidden');
    document.getElementById('custom-modal').classList.remove('hidden');
    modalCallback = null;
}
function showCustomConfirm(title, message, callback) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-icon').innerHTML = `<svg width="48" height="48" fill="none" stroke="#f59e0b" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
    document.getElementById('modal-btn-cancel').classList.remove('hidden');
    document.getElementById('modal-input').classList.add('hidden');
    document.getElementById('custom-modal').classList.remove('hidden');
    modalCallback = callback;
}
function showCustomPrompt(title, message, callback) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('modal-icon').innerHTML = `<svg width="48" height="48" fill="none" stroke="#3b82f6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>`;
    document.getElementById('modal-btn-cancel').classList.remove('hidden');
    
    const inputEl = document.getElementById('modal-input');
    inputEl.value = '';
    inputEl.classList.remove('hidden');
    
    document.getElementById('custom-modal').classList.remove('hidden');
    inputEl.focus();
    modalCallback = callback;
}
window.closeCustomModal = function(isConfirm) {
    document.getElementById('custom-modal').classList.add('hidden');
    
    let result = isConfirm;
    const inputEl = document.getElementById('modal-input');
    if (!inputEl.classList.contains('hidden') && isConfirm) {
        result = inputEl.value;
    }
    
    if (modalCallback) {
        const cb = modalCallback;
        modalCallback = null;
        // Use setTimeout to allow the DOM to hide the modal before the callback potentially re-opens it
        setTimeout(() => {
            cb(result);
        }, 50);
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

function openScheduleModal() {
    const kelasSelect = document.getElementById('schedule-kelas');
    const uniqueClasses = [...new Set(globalVoters.map(v => v.kelas))].filter(Boolean).sort();
    
    kelasSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    uniqueClasses.forEach(kelas => {
        const option = document.createElement('option');
        option.value = kelas;
        option.textContent = kelas;
        kelasSelect.appendChild(option);
    });
    
    kelasSelect.disabled = false;
    document.querySelector('#schedule-modal h2').textContent = 'Tambah/Edit Jadwal Voting';
    document.getElementById('schedule-day').value = 'Senin';
    document.getElementById('schedule-start').value = '';
    document.getElementById('schedule-end').value = '';
    const modal = document.getElementById('schedule-modal');
    modal.classList.remove('hidden');
    modal.style.zIndex = '9999';
}

function closeScheduleModal() {
    document.getElementById('schedule-modal').classList.add('hidden');
}

async function loadSchedules() {
    try {
        const res = await fetch('/api/admin/class-schedules');
        const data = await res.json();
        
        if (data.success) {
            renderScheduleList(data.data);
        }
    } catch (error) {
        console.error('Gagal load schedules', error);
    }
}

function renderScheduleList(schedules) {
    const tbody = document.getElementById('schedule-list-body');
    if (!tbody) return;
    
    if (schedules.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748B;">Belum ada jadwal voting.</td></tr>`;
        return;
    }
    
    let html = '';
    schedules.forEach(s => {
        const now = new Date();
        const idTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const currentDay = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][idTime.getUTCDay()];
        const currentTime = idTime.toUTCString().split(' ')[4].slice(0, 5);
        
        const isScheduleActive = s.is_active && s.day === currentDay && currentTime >= s.start_time && currentTime <= s.end_time;
        const statusHTML = isScheduleActive ? `<span style="color:var(--success); font-weight:600;">🟢 Aktif</span>` : `<span style="color:#DC2626; font-weight:600;">🔴 Nonaktif</span>`;
        
        html += `
            <tr>
                <td>${s.kelas}</td>
                <td>${s.day}</td>
                <td>${s.start_time}</td>
                <td>${s.end_time}</td>
                <td>${statusHTML}</td>
                <td>
                    <button style="background:none; border:none; color:#f59e0b; cursor:pointer; font-weight:600; margin-right:10px;" onclick="editSchedule(&quot;${s.kelas}&quot;, &quot;${s.day}&quot;, &quot;${s.start_time}&quot;, &quot;${s.end_time}&quot;)">Edit</button>
                    <button style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:600;" onclick="deleteSchedule(&quot;${s.kelas}&quot;)">Hapus</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function saveSchedule() {
    const kelasSelect = document.getElementById('schedule-kelas');
    const kelas = kelasSelect.value.trim();
    const day = document.getElementById('schedule-day').value;
    const start_time = document.getElementById('schedule-start').value;
    const end_time = document.getElementById('schedule-end').value;
    
    if (!kelas || !day || !start_time || !end_time) {
        showCustomAlert('Error', 'Semua field harus diisi', true);
        return;
    }
    
    if (start_time >= end_time) {
        showCustomAlert('Error', 'Jam mulai harus lebih awal dari jam selesai', true);
        return;
    }
    
    try {
        const res = await fetch('/api/admin/class-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kelas, day, start_time, end_time, is_active: true })
        });
        
        const data = await res.json();
        if (data.success) {
            showCustomAlert('Berhasil', data.message, false);
            closeScheduleModal();
            loadSchedules();
        } else {
            showCustomAlert('Error', data.message, true);
        }
    } catch (error) {
        showCustomAlert('Error', 'Gagal simpan jadwal', true);
    }
}

function editSchedule(kelas, day, start_time, end_time) {
    openScheduleModal();
    document.getElementById('schedule-kelas').value = kelas;
    document.getElementById('schedule-kelas').disabled = true;
    document.getElementById('schedule-day').value = day;
    document.getElementById('schedule-start').value = start_time;
    document.getElementById('schedule-end').value = end_time;
    document.querySelector('#schedule-modal h2').textContent = 'Edit Jadwal Voting';
}

async function deleteSchedule(kelas) {
    showCustomConfirm('Hapus Jadwal?', `Apakah Anda yakin ingin menghapus jadwal voting untuk kelas ${kelas}?`, async (confirmed) => {
        if (!confirmed) return;
        
        try {
            const res = await fetch(`/api/admin/class-schedules/${kelas}`, { method: 'DELETE' });
            const data = await res.json();
            
            if (data.success) {
                showCustomAlert('Berhasil', 'Jadwal berhasil dihapus', false);
                loadSchedules();
            } else {
                showCustomAlert('Error', data.message, true);
            }
        } catch (error) {
            showCustomAlert('Error', 'Gagal hapus jadwal', true);
        }
    });
}
