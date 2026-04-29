"use client";

import { supabase } from "@/lib/supabase";

export default function TestPage() {
  // Test connection
  async function testConnection() {
    const { data, error } = await supabase.auth.getSession();

    console.log(data, error);

    if (error) {
      alert("Error connecting to Supabase: " + error.message);
    } else {
      alert("Connected to Supabase ");
    }
  }

  // Create test user
  async function signUp() {
    const email = `test${Date.now()}@example.com`; //  dynamic email
    const password = "password123";

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("already registered")) {
        alert("User already exists (this is expected if reused)");
      } else {
        alert("Error creating user: " + error.message);
      }
    } else {
      alert(`User created successfully \nEmail: ${email}`);
    }
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Supabase Test</h1>
      <p style={{ marginTop: "10px", color: "#666" }}>
        Use these buttons to verify connection and authentication.
      </p>

      {/* Connection button */}
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
          marginTop: "20px",
        }}
      >
        Test Connection
      </button>

      {/* Signup button */}
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
          marginTop: "20px",
          marginLeft: "10px",
        }}
      >
        Create Test User
      </button>
    </div>
  );
}