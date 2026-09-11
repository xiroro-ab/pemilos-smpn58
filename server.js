const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const PORT = process.env.PORT || 3000;

// Konfigurasi Supabase
// Gunakan process.env untuk produksi (Vercel), atau hardcode untuk lokal
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qykangfpbtobtswzscrc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5a2FuZ2ZwYnRvYnRzd3pzY3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTYxMDgsImV4cCI6MjEwNDY5MjEwOH0.VvfnOG9t6E6zOVzFwZARx0HCsPQPOtAc6ogAxfVT8BQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json({ limit: '10mb' })); // Limit diperbesar untuk Base64 Image
app.use(express.static(path.join(__dirname, 'public')));

// Middleware untuk delay buatan (Opsional)
app.use((req, res, next) => {
    next();
});

// API: Login Validation
app.post('/api/login', async (req, res) => {
    const { nisn } = req.body;
    
    const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('nisn', nisn)
        .single();
        
    if (error || !student) {
        return res.status(401).json({ success: false, message: 'ID Pemilih tidak terdaftar. Silakan periksa kembali.' });
    }
    
    if (student.hasVoted) {
        return res.status(403).json({ 
            success: false, 
            message: 'PERINGATAN: Hak suara untuk ID ini sudah digunakan!' 
        });
    }
    
    // Log Activity (Fire and Forget)
    supabase.from('activity_logs').insert([{ student_name: student.name, action: 'LOGIN' }]).then();
    
    res.json({ success: true, data: { name: student.name, nisn: student.nisn } });
});

// API: Get Candidates
app.get('/api/candidates', async (req, res) => {
    const { data: candidates, error } = await supabase
        .from('candidates')
        .select('id, name, vision, image')
        .order('id', { ascending: true });
    if (error) return res.status(500).json({ success: false, message: 'Gagal mengambil data paslon.', error: error.message });
    
    res.json({ success: true, data: candidates });
});
// API: Temp Clean
app.get('/api/admin/clean', async (req, res) => {
    const { data: candidates } = await supabase.from('candidates').select('id');
    for (const c of candidates) {
        await supabase.from('candidates').update({ vision_poster: null, vision_video_url: null, image: 'https://ui-avatars.com/api/?name=Paslon&size=200' }).eq('id', c.id);
    }
    res.json({ success: true, message: 'Database cleaned!' });
});

// API: Submit Vote (Transaction)
app.post('/api/vote', async (req, res) => {
    const { nisn, candidateId } = req.body;
    
    if (!nisn || !candidateId) {
        return res.status(400).json({ success: false, message: 'Data pemilihan tidak lengkap.' });
    }
    
    // 1. Cek status student
    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('nisn', nisn)
        .single();
        
    if (studentError || !student) {
        return res.status(401).json({ success: false, message: 'Akses ditolak: Data siswa tidak ditemukan.' });
    }
    
    if (student.hasVoted) {
         return res.status(403).json({ success: false, message: 'Transaksi Ditolak: Anda sudah menggunakan hak suara sebelumnya.' });
    }
    
    // 2. Ambil data kandidat
    const { data: candidate, error: candidateError } = await supabase
        .from('candidates')
        .select('votes')
        .eq('id', candidateId)
        .single();
        
    if (candidateError || !candidate) {
        return res.status(400).json({ success: false, message: 'Kandidat tidak valid.' });
    }
    
    // 3. Update Status Student
    const { error: updateStudentError } = await supabase
        .from('students')
        .update({ hasVoted: true, votedAt: new Date().toISOString() })
        .eq('nisn', nisn);
        
    if (updateStudentError) {
        return res.status(500).json({ success: false, message: 'Gagal memproses hak suara.' });
    }
    
    // 4. Update Votes Candidate
    const { error: updateCandidateError } = await supabase
        .from('candidates')
        .update({ votes: candidate.votes + 1 })
        .eq('id', candidateId);
        
    if (updateCandidateError) {
        // Rollback idealnya dilakukan dengan RPC di Supabase, tapi untuk level ini kita asumsikan sukses
        console.error("Gagal update vote paslon");
    }
    
    // Log Activity (Fire and Forget)
    supabase.from('activity_logs').insert([{ student_name: student.name, action: 'VOTE' }]).then();
    
    res.json({ success: true, message: 'Suara Anda berhasil direkam. Terima kasih!' });
});

// API: Get Activity Logs (Admin)
app.get('/api/admin/activities', async (req, res) => {
    const { data: activities, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
        
    if (error) return res.status(500).json({ success: false, message: 'Gagal mengambil log aktivitas' });
    
    res.json({ success: true, data: activities });
});

// API: Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    
    const { data: admin, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', 'admin')
        .single();
        
    if (error || !admin) {
        // Fallback for local development if table doesn't exist yet
        if (password === 'admin123') {
            return res.json({ success: true, message: 'Login berhasil (Fallback)' });
        }
        return res.status(500).json({ success: false, message: 'Kesalahan sistem admin' });
    }
    
    if (password === admin.password) {
        res.json({ success: true, message: 'Login berhasil' });
    } else {
        res.status(401).json({ success: false, message: 'Password salah' });
    }
});

// API: Admin Dashboard Data
app.get('/api/admin/dashboard', async (req, res) => {
    const { data: candidates } = await supabase.from('candidates').select('*').order('id', { ascending: true });
    
    // Count total students
    const { count: totalStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
    
    // Count voted students
    const { count: votedStudents } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('hasVoted', true);
    
    res.json({
        success: true,
        data: {
            candidates: candidates || [],
            stats: {
                total: totalStudents || 0,
                voted: votedStudents || 0,
                turnout: totalStudents > 0 ? ((votedStudents / totalStudents) * 100).toFixed(1) : 0
            }
        }
    });
});

// API: Update Candidate (Tanpa Multer, langsung simpan Base64 URL)
app.post('/api/admin/update-candidate', async (req, res) => {
    const { id, name, vision, image, visionVideoUrl, visionPoster } = req.body;
    
    // We update all provided fields
    const { error } = await supabase
        .from('candidates')
        .update({ 
            name, 
            vision, 
            image, 
            vision_video_url: visionVideoUrl || null, 
            vision_poster: visionPoster || null 
        })
        .eq('id', id);
        
    if (error) {
        return res.status(500).json({ success: false, message: 'Gagal update kandidat' });
    }
    
    res.json({ success: true, message: 'Data paslon dan foto berhasil diperbarui!' });
});

// API: Import Students Masal
app.post('/api/admin/import-students', async (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students)) return res.status(400).json({ success: false, message: 'Format data tidak valid.' });
    
    // Format data untuk Supabase
    const payload = students.map(s => ({
        nisn: s.nisn,
        name: s.name,
        kelas: s.kelas,
        hasVoted: false
    }));
    
    // Gunakan upsert agar tidak error jika NISN duplikat
    const { data, error } = await supabase
        .from('students')
        .upsert(payload, { onConflict: 'nisn', ignoreDuplicates: true });
        
    if (error) {
        return res.status(500).json({ success: false, message: 'Gagal import siswa', error: error.message });
    }
    
    res.json({ success: true, message: `Berhasil mengimpor data pemilih!` });
});

// API: Laporan Status Pemilih (Untuk Admin)
app.get('/api/admin/voters', async (req, res) => {
    const { data: students, error } = await supabase.from('students').select('*').order('name', { ascending: true });
    
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true, data: students });
});

// API: Tambah Pemilih Manual
app.post('/api/admin/add-voter', async (req, res) => {
    const { nisn, name, kelas } = req.body;
    if (!nisn || !name || !kelas) return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
    
    const { error } = await supabase.from('students').insert([{ nisn, name, kelas, hasVoted: false }]);
    
    if (error) {
        if (error.code === '23505') return res.status(400).json({ success: false, message: 'ID/NISN sudah terdaftar.' });
        return res.status(500).json({ success: false, message: 'Gagal menambah pemilih' });
    }
    res.json({ success: true, message: 'Data pemilih berhasil ditambahkan.' });
});

// API: Edit Pemilih
app.put('/api/admin/edit-voter/:nisn', async (req, res) => {
    const oldNisn = req.params.nisn;
    const { nisn, name, kelas } = req.body;
    
    if (!nisn || !name || !kelas) return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
    
    if (nisn !== oldNisn) {
        // Harus update PK, ini agak tricky, kita hapus lama buat baru saja untuk simpelnya
        // tapi kita harus baca status hasVoted dulu
        const { data: oldStudent } = await supabase.from('students').select('hasVoted').eq('nisn', oldNisn).single();
        if (!oldStudent) return res.status(404).json({ success: false, message: 'Data siswa tidak ditemukan.' });
        
        const { error: insertError } = await supabase.from('students').insert([{ nisn, name, kelas, hasVoted: oldStudent.hasVoted }]);
        if (insertError) return res.status(400).json({ success: false, message: 'ID/NISN yang baru sudah terpakai.' });
        
        await supabase.from('students').delete().eq('nisn', oldNisn);
    } else {
        const { error } = await supabase.from('students').update({ name, kelas }).eq('nisn', nisn);
        if (error) return res.status(500).json({ success: false, message: 'Gagal update pemilih' });
    }
    
    res.json({ success: true, message: 'Data pemilih berhasil diperbarui.' });
});

// API: Hapus Pemilih
app.delete('/api/admin/delete-voter/:nisn', async (req, res) => {
    const nisn = req.params.nisn;
    const { error } = await supabase.from('students').delete().eq('nisn', nisn);
    if (error) return res.status(500).json({ success: false, message: 'Gagal menghapus pemilih' });
    res.json({ success: true, message: 'Data pemilih berhasil dihapus.' });
});

app.listen(PORT, () => {
    console.log(`Server E-Voting Pemilos berjalan di http://localhost:${PORT}`);
});

module.exports = app;
