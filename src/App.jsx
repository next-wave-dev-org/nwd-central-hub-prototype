import { useState } from 'react'
import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userRole, setUserRole] = useState(null)

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
  
    if (error) {
      alert(error.message)
      return
    }
  
    const user = data.user
  
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
  
    if (profileError) {
      alert("Error fetching role")
      return
    }
  
    alert("Logged in as: " + profile.role)
    setUserRole(profile.role)
  }
  

  const handleSignup = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
  
    if (error) {
      alert(error.message)
      return
    }
  
    if (data.user) {
      await supabase.from('profiles').insert([
        {
          id: data.user.id,
          role: 'Client'
        }
      ])
    }
  
    alert("Account created with role Client")
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUserRole(null)
  }
  

  if (userRole) {
    return (
      <div>
        <Navbar role={userRole} />
        <h1>{userRole} Dashboard</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>
    )
  }
   
  
  return (
    <div style={{ padding: "40px" }}>
      <h1>Login</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br /><br />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br /><br />

      <button onClick={handleLogin}>Login</button>
      <button onClick={handleSignup}>Sign Up</button>
    </div>
  )
}

export default App
