
const SUPABASE_URL = "https://idtvraunqmfjgnyehqpl.supabase.co/rest/v1/";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkdHZyYXVucW1mamdueWVocXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDc5NzAsImV4cCI6MjA5NzEyMzk3MH0.K3CvXgKSwxvfvz2fzjqBgtXtQTM65BEWlhuMUNvJ_fE";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);