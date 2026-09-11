const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qykangfpbtobtswzscrc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5a2FuZ2ZwYnRvYnRzd3pzY3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTYxMDgsImV4cCI6MjEwNDY5MjEwOH0.VvfnOG9t6E6zOVzFwZARx0HCsPQPOtAc6ogAxfVT8BQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
    const { data, error } = await supabase.from('candidates').upsert([
        { id: 1, name: 'Paslon 01', vision: 'Visi Misi Paslon 1', image: 'https://raw.githubusercontent.com/xiroro-ab/smp58dataguru/refs/heads/main/1.png', votes: 0 },
        { id: 2, name: 'Paslon 02', vision: 'Visi Misi Paslon 2', image: 'https://raw.githubusercontent.com/xiroro-ab/smp58dataguru/refs/heads/main/2.png', votes: 0 },
        { id: 3, name: 'Paslon 03', vision: 'Visi Misi Paslon 3', image: 'https://raw.githubusercontent.com/xiroro-ab/smp58dataguru/refs/heads/main/3.png', votes: 0 },
        { id: 4, name: 'Paslon 04', vision: 'Visi Misi Paslon 4', image: 'https://raw.githubusercontent.com/xiroro-ab/smp58dataguru/refs/heads/main/4.png', votes: 0 }
    ]);
    if (error) console.error("Error seeding:", error.message);
    else console.log("Seeding Success!");
}

seed();
