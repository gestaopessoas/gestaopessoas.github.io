const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function distributeLockers() {
  const { data, error } = await supabase.from("lockers").select("id, number").order("number");
  if (error) {
    console.error(error);
    return;
  }

  const total = data.length;
  const third = Math.floor(total / 3);

  for (let i = 0; i < total; i++) {
    const locker = data[i];
    let location = "Lado Oeste";
    if (i >= third && i < third * 2) location = "Corredor";
    if (i >= third * 2) location = "Lado Leste";

    await supabase.from("lockers").update({ location }).eq("id", locker.id);
  }
  
  console.log(`Distributed ${total} lockers into 3 locations.`);
}

distributeLockers();
