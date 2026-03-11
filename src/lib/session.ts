import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabase";

const KEY = "anon_session_id";

export async function getOrCreateSessionId(): Promise<string> {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(KEY);

  if (!id) {
    id = uuidv4();
    localStorage.setItem(KEY, id);

    const { error } = await supabase.from("sessions").insert({ id });
    if (error) console.warn("sessions insert error:", error.message);
  }

  return id;
}
