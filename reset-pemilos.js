const { createClient } = require('@supabase/supabase-js');

// Menggunakan key yang sama dari server.js
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qykangfpbtobtswzscrc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5a2FuZ2ZwYnRvYnRzd3pzY3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTYxMDgsImV4cCI6MjEwNDY5MjEwOH0.VvfnOG9t6E6zOVzFwZARx0HCsPQPOtAc6ogAxfVT8BQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resetDatabase() {
    console.log('🔄 Memulai proses reset database Pemilos...');

    try {
        // 1. Reset Status Semua Siswa
        console.log('⏳ Mereset status hak suara siswa...');
        const { error: studentError } = await supabase
            .from('students')
            .update({ hasVoted: false, votedAt: null })
            .neq('nisn', 'impossible_value_to_force_update_all'); // Dummy condition to update all

        // Note: Supabase requires a filter to update multiple rows. 
        // We can use `.gt('id', 0)` or just fetch all and update.
        // Let's do it safely by fetching all IDs first.
        
        const { data: students } = await supabase.from('students').select('nisn');
        if (students && students.length > 0) {
            const studentIds = students.map(s => s.nisn);
            const { error: err1 } = await supabase
                .from('students')
                .update({ hasVoted: false, votedAt: null })
                .in('nisn', studentIds);
            
            if (err1) throw err1;
            console.log(`✅ Berhasil mereset ${students.length} data siswa!`);
        }

        // 2. Reset Suara Kandidat
        console.log('⏳ Mereset perolehan suara kandidat...');
        const { data: candidates } = await supabase.from('candidates').select('id');
        if (candidates && candidates.length > 0) {
            const candidateIds = candidates.map(c => c.id);
            const { error: err2 } = await supabase
                .from('candidates')
                .update({ votes: 0 })
                .in('id', candidateIds);
            
            if (err2) throw err2;
            console.log(`✅ Berhasil mereset suara ${candidates.length} kandidat menjadi 0!`);
        }

        // 3. Hapus Log Aktivitas (Opsional)
        console.log('⏳ Menghapus log aktivitas pengujian...');
        const { error: logError } = await supabase
            .from('activity_logs')
            .delete()
            .neq('id', 0); // Delete all rows
            
        if (!logError) {
            console.log('✅ Berhasil membersihkan log aktivitas!');
        }

        console.log('🎉 PROSES RESET SELESAI! Database sudah bersih dan siap untuk Hari-H Pemilos.');

    } catch (error) {
        console.error('❌ Gagal mereset database:', error.message);
    }
}

resetDatabase();
