const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const PORT = process.env.PORT || 3000;

// Konfigurasi Supabase
// Gunakan process.env untuk produksi (Vercel), atau hardcode untuk lokal
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qykangfpbtobtswzscrc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5a2FuZ2ZwYnRvYnRzd3pzY3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTYxMDgsImV4cCI6MjEwNDY5MjEwOH0.VvfnOG9t6E6zOVzFwZARx0HCsPQPOtAc6ogAxfVT8BQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

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
    
    const { data: schedule } = await supabase
        .from('class_schedules')
        .select('*')
        .eq('kelas', student.kelas)
        .single();
    
    if (schedule) {
        const now = new Date();
        const idTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const currentDay = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][idTime.getUTCDay()];
        const currentTime = idTime.toUTCString().split(' ')[4].slice(0, 5);
        
        if (schedule.day !== currentDay) {
            return res.status(403).json({ 
                success: false, 
                message: `Jadwal voting kelas ${student.kelas} adalah hari ${schedule.day}. Hari ini ${currentDay}.` 
            });
        }
        
        if (currentTime < schedule.start_time || currentTime > schedule.end_time) {
            return res.status(403).json({ 
                success: false, 
                message: `Jadwal voting kelas ${student.kelas} dimulai pukul ${schedule.start_time} - ${schedule.end_time}. Saat ini ${currentTime}.` 
            });
        }
    }
    
    // Log Activity (Fire and Forget)
    supabase.from('activity_logs').insert([{ student_name: student.name, action: 'LOGIN' }]).then();
    
    res.json({ success: true, data: { name: student.name, nisn: student.nisn } });
});

// API: Get Candidates
app.get('/api/candidates', async (req, res) => {
    const { data: candidates, error } = await supabase
        .from('candidates')
        .select('id, name, vision, image, vision_video_url, vision_poster')
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

// API: Reset Database (Hari-H)
app.post('/api/admin/reset-database', async (req, res) => {
    try {
        // Reset Students
        const { data: students } = await supabase.from('students').select('nisn');
        if (students && students.length > 0) {
            const studentIds = students.map(s => s.nisn);
            await supabase.from('students').update({ hasVoted: false, votedAt: null }).in('nisn', studentIds);
        }
        
        // Reset Candidates
        const { data: candidates } = await supabase.from('candidates').select('id');
        if (candidates && candidates.length > 0) {
            const candidateIds = candidates.map(c => c.id);
            await supabase.from('candidates').update({ votes: 0 }).in('id', candidateIds);
        }
        
        // Clear Activity Logs
        await supabase.from('activity_logs').delete().neq('id', 0);
        
        res.json({ success: true, message: 'Database berhasil di-reset untuk Hari-H Pemilos!' });
    } catch (error) {
        console.error('Reset Database Error:', error);
        res.status(500).json({ success: false, message: 'Gagal mereset database: ' + error.message });
    }
});

const voteLimiter = new Map();

// API: Submit Vote (Atomik dengan RPC)
app.post('/api/vote', (req, res, next) => {
    const key = req.body?.nisn;
    if (!key) return res.status(400).json({ success: false, message: 'NISN tidak ada' });
    
    if (voteLimiter.has(key)) {
        return res.status(429).json({ success: false, message: 'Tunggu 5 detik sebelum request ulang' });
    }
    
    voteLimiter.set(key, true);
    setTimeout(() => voteLimiter.delete(key), 5000);
    next();
}, async (req, res) => {
    const { nisn, candidateId } = req.body;
    
    if (!nisn || !candidateId) {
        return res.status(400).json({ success: false, message: 'Data pemilihan tidak lengkap.' });
    }
    
    try {
        // Panggil RPC function yang atomik
        const { data, error } = await supabase.rpc('submit_vote', {
            p_nisn: nisn,
            p_candidate_id: candidateId
        });
        
        if (error) {
            console.error('RPC Error:', error);
            return res.status(500).json({ success: false, message: 'Gagal memproses suara: ' + error.message });
        }
        
        // Log Activity (Fire and Forget)
        const { data: student } = await supabase.from('students').select('name').eq('nisn', nisn).single();
        if (student) {
            supabase.from('activity_logs').insert([{ student_name: student.name, action: 'VOTE' }]).then();
        }
        
        res.json(data);
    } catch (error) {
        console.error('Vote Error:', error);
        res.status(500).json({ success: false, message: 'Kesalahan server: ' + error.message });
    }
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

// API: Delete All Voters
app.post('/api/admin/delete-all-voters', async (req, res) => {
    try {
        const { error } = await supabase
            .from('students')
            .delete()
            .neq('nisn', '');
        
        if (error) {
            return res.status(500).json({ success: false, message: 'Gagal menghapus data pemilih: ' + error.message });
        }
        
        // Hapus juga activity logs (LOGIN, VOTE)
        await supabase.from('activity_logs').delete().neq('id', 0);
        
        res.json({ success: true, message: 'Semua data pemilih dan log aktivitas berhasil dihapus!' });
    } catch (error) {
        console.error('Delete All Voters Error:', error);
        res.status(500).json({ success: false, message: 'Kesalahan server: ' + error.message });
    }
});

// API: Get Class Schedules
app.get('/api/admin/class-schedules', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('class_schedules')
            .select('*')
            .order('kelas', { ascending: true });
        
        if (error) return res.status(500).json({ success: false, message: 'Gagal mengambil jadwal kelas' });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan server' });
    }
});

// API: Add/Update Class Schedule
app.post('/api/admin/class-schedules', async (req, res) => {
    const { kelas, day, start_time, end_time, is_active } = req.body;
    
    if (!kelas || !day || !start_time || !end_time) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }
    
    try {
        const { data: existing, error: checkError } = await supabase
            .from('class_schedules')
            .select('id')
            .eq('kelas', kelas);
        
        if (existing && existing.length > 0) {
            const { error } = await supabase
                .from('class_schedules')
                .update({ day, start_time, end_time, is_active: is_active !== false })
                .eq('kelas', kelas);
            
            if (error) return res.status(500).json({ success: false, message: 'Gagal update jadwal' });
            res.json({ success: true, message: 'Jadwal kelas berhasil diperbarui' });
        } else {
            const { error } = await supabase
                .from('class_schedules')
                .insert([{ kelas, day, start_time, end_time, is_active: is_active !== false }]);
            
            if (error) return res.status(500).json({ success: false, message: 'Gagal menambah jadwal' });
            res.json({ success: true, message: 'Jadwal kelas berhasil ditambahkan' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan server' });
    }
});

// API: Delete Class Schedule
app.delete('/api/admin/class-schedules/:kelas', async (req, res) => {
    const { kelas } = req.params;
    
    try {
        const { error } = await supabase
            .from('class_schedules')
            .delete()
            .eq('kelas', kelas);
        
        if (error) return res.status(500).json({ success: false, message: 'Gagal menghapus jadwal' });
        res.json({ success: true, message: 'Jadwal kelas berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan server' });
    }
});

// API: Validate Class Schedule saat Login
app.post('/api/validate-class-schedule', async (req, res) => {
    const { nisn } = req.body;
    
    try {
        const { data: student } = await supabase
            .from('students')
            .select('kelas')
            .eq('nisn', nisn)
            .single();
        
        if (!student) {
            return res.status(401).json({ success: false, message: 'Siswa tidak ditemukan' });
        }
        
        const { data: schedule } = await supabase
            .from('class_schedules')
            .select('*')
            .eq('kelas', student.kelas)
            .single();
        
        if (!schedule) {
            return res.json({ success: true, allowed: true, message: 'Tidak ada jadwal, akses terbuka' });
        }
        
        const now = new Date();
        const idTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const currentDay = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][idTime.getUTCDay()];
        const currentTime = idTime.toUTCString().split(' ')[4].slice(0, 5);
        
        if (schedule.day !== currentDay) {
            return res.json({ success: false, allowed: false, message: `Jadwal voting kelas ${student.kelas} adalah hari ${schedule.day}. Hari ini ${currentDay}.` });
        }
        
        if (currentTime < schedule.start_time || currentTime > schedule.end_time) {
            return res.json({ success: false, allowed: false, message: `Jadwal voting kelas ${student.kelas} dimulai pukul ${schedule.start_time} - ${schedule.end_time}. Saat ini ${currentTime}.` });
        }
        
        res.json({ success: true, allowed: true, message: 'Akses diizinkan' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan server' });
    }
});

module.exports = app;
