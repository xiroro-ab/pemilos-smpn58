// Global State
let currentUser = null;

// DOM Elements
const views = {
    login: document.getElementById('login-view'),
    vote: document.getElementById('vote-view'),
    success: document.getElementById('success-view')
};

const elements = {
    loginForm: document.getElementById('login-form'),
    nisnInput: document.getElementById('nisn'),
    loginError: document.getElementById('login-error'),
    loading: document.getElementById('loading'),
    studentName: document.getElementById('student-name'),
    successName: document.getElementById('success-name'),
    candidatesContainer: document.getElementById('candidates-container')
};

// Switch Views
function showView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    Object.values(views).forEach(v => v.classList.add('hidden'));
    
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active');
}

// Show/Hide Loading
function setLoading(isLoading) {
    if (isLoading) {
        elements.loading.classList.remove('hidden');
    } else {
        elements.loading.classList.add('hidden');
    }
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

// Handle Login
elements.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nisn = elements.nisnInput.value.trim();
    
    elements.loginError.textContent = '';
    setLoading(true);

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nisn })
        });
        
        const data = await res.json();
        
        if (data.success) {
            setLoading(false); // Hide loading temporarily for modal
            
            // Konfirmasi Nama dengan Custom Pop-up
            showCustomConfirm('Konfirmasi Identitas', `Apakah benar ini Anda?\nNama Pemilih: ${data.data.name}`, async (isConfirmed) => {
                if (!isConfirmed) {
                    elements.nisnInput.value = '';
                    return;
                }
                
                currentUser = data.data;
                elements.studentName.textContent = currentUser.name;
                
                setLoading(true);
                await loadCandidates();
                setLoading(false);
                showView('vote');
            });
            return;
        } else {
            showCustomAlert('Akses Ditolak', data.message, true);
        }
    } catch (error) {
        showCustomAlert('Kesalahan', 'Terjadi kesalahan jaringan. Coba lagi.', true);
    }
    
    setLoading(false);
});

// Load Candidates
async function loadCandidates() {
    try {
        const res = await fetch('/api/candidates');
        const data = await res.json();
        
        if (data.success) {
            renderCandidates(data.data);
        }
    } catch (error) {
        console.error("Gagal memuat kandidat", error);
    }
}

// Render Candidates
function renderCandidates(candidates) {
    elements.candidatesContainer.innerHTML = '';
    
    candidates.forEach(c => {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        card.innerHTML = `
            <img src="${c.image}" alt="Paslon ${c.id}" class="candidate-img" onerror="this.src='https://ui-avatars.com/api/?name=0${c.id}&background=1e293b&color=3b82f6&size=200&bold=true'">
            <h3 class="candidate-name">0${c.id} - ${c.name}</h3>
            <p class="candidate-vision">"${c.vision}"</p>
            <button class="btn-vote" onclick="castVote(${c.id}, '${c.name}')">Pilih Paslon 0${c.id}</button>
        `;
        elements.candidatesContainer.appendChild(card);
    });
}

// Cast Vote
function castVote(candidateId, candidateName) {
    showCustomConfirm('Konfirmasi Pilihan Akhir', `Anda akan memberikan suara untuk Paslon 0${candidateId} (${candidateName}).\n\nPilihan yang sudah disubmit tidak dapat diubah lagi!`, async (isConfirmed) => {
        if (!isConfirmed) return;
        
        setLoading(true);
        
        try {
            const res = await fetch('/api/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nisn: currentUser.nisn,
                    candidateId: candidateId
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                elements.successName.textContent = currentUser.name;
                showView('success');
                
                // Fire Confetti 🎉
                if (typeof confetti === 'function') {
                    const duration = 3000;
                    const end = Date.now() + duration;

                    (function frame() {
                        confetti({
                            particleCount: 5,
                            angle: 60,
                            spread: 55,
                            origin: { x: 0 },
                            colors: ['#3b82f6', '#10b981', '#f59e0b']
                        });
                        confetti({
                            particleCount: 5,
                            angle: 120,
                            spread: 55,
                            origin: { x: 1 },
                            colors: ['#3b82f6', '#10b981', '#f59e0b']
                        });

                        if (Date.now() < end) {
                            requestAnimationFrame(frame);
                        }
                    }());
                }
                
                currentUser = null; // Clear session
            } else {
                showCustomAlert('Transaksi Ditolak', data.message, true);
                // If already voted error, kick to login page after a delay
                if (data.message.includes("sudah menggunakan") || data.message.includes("Ditolak")) {
                    setTimeout(() => location.reload(), 3000);
                }
            }
        } catch (error) {
            showCustomAlert('Kesalahan Jaringan', 'Terjadi kesalahan. Suara mungkin belum masuk.', true);
        } finally {
            setLoading(false);
        }
    });
}

// Cancel / Back to Login
window.logoutStudent = function() {
    showCustomConfirm('Batal Memilih?', 'Apakah Anda yakin ingin membatalkan proses pemilihan dan kembali ke halaman awal?', (isConfirmed) => {
        if (isConfirmed) {
            currentUser = null;
            elements.nisnInput.value = '';
            showView('login');
        }
    });
}


 
 / /   D o w n l o a d   T i c k e t   a s   I m a g e 
 w i n d o w . d o w n l o a d B a d g e   =   f u n c t i o n ( )   { 
         c o n s t   b a d g e E l e m e n t   =   d o c u m e n t . q u e r y S e l e c t o r ( ' # s u c c e s s - v i e w   >   d i v ' ) ; 
         
         i f   ( t y p e o f   h t m l 2 c a n v a s   ! = =   ' u n d e f i n e d ' )   { 
                 c o n s t   o r i g i n a l R a d i u s   =   b a d g e E l e m e n t . s t y l e . b o r d e r R a d i u s ; 
                 b a d g e E l e m e n t . s t y l e . b o r d e r R a d i u s   =   ' 0 ' ; 
                 
                 h t m l 2 c a n v a s ( b a d g e E l e m e n t ,   { 
                         s c a l e :   2 , 
                         b a c k g r o u n d C o l o r :   ' # 0 f 1 7 2 a ' , 
                         l o g g i n g :   f a l s e 
                 } ) . t h e n ( c a n v a s   = >   { 
                         b a d g e E l e m e n t . s t y l e . b o r d e r R a d i u s   =   o r i g i n a l R a d i u s ; 
                         
                         c o n s t   l i n k   =   d o c u m e n t . c r e a t e E l e m e n t ( ' a ' ) ; 
                         l i n k . d o w n l o a d   =   ' V o t e r - P a s s - '   +   ( c u r r e n t U s e r   ?   c u r r e n t U s e r . n i s n   :   ' P e m i l o s ' )   +   ' . p n g ' ; 
                         l i n k . h r e f   =   c a n v a s . t o D a t a U R L ( ' i m a g e / p n g ' ) ; 
                         l i n k . c l i c k ( ) ; 
                 } ) . c a t c h ( e r r   = >   { 
                         c o n s o l e . e r r o r ( ' G a g a l   m e m b u a t   s c r e e n s h o t : ' ,   e r r ) ; 
                         a l e r t ( ' M a a f ,   f i t u r   s i m p a n   g a m b a r   t i d a k   d i d u k u n g   d i   p e r a n g k a t   i n i . ' ) ; 
                 } ) ; 
         }   e l s e   { 
                 a l e r t ( ' L i b r a r y   s c r e e n s h o t   b e l u m   t e r m u a t   s e m p u r n a .   S i l a k a n   s c r e e n s h o t   m a n u a l . ' ) ; 
         } 
 }  
 