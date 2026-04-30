"use client";

import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function TestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  async function testConnection() {
    const { data, error } = await supabase.auth.getSession();

    console.log(data, error);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Connected to Supabase ");
    }
  }

  async function signUp() {
    const { error } = await supabase.auth.signUp({
      email: "test2@example.com",
      password: "password123",
    });

    if (error) {
      alert(error.message);
    } else {
      alert("User created ");
    }
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Supabase Test</h1>

      <button
        onClick={testConnection}
        style={{
          padding: "12px 20px",
          backgroundColor: "#000",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "16px",
          marginTop: "10px",
        }}
      >
        Test Connection
      </button>

      <button
        onClick={signUp}
        style={{
          padding: "12px 20px",
          backgroundColor: "#4CAF50",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "16px",
          marginTop: "10px",
          marginLeft: "10px",
        }}
      >
        Create Test User
      </button>
    </div>
  );
}
