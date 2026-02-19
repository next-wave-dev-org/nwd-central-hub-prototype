function Navbar({ role }) {
    if (role === "Admin") {
      return (
        <div>
          <button>Dashboard</button>
          <button>Approve</button>
          <button>Manage Users</button>
        </div>
      )
    }
  
    if (role === "Client") {
      return (
        <div>
          <button>Dashboard</button>
          <button>My Projects</button>
        </div>
      )
    }
  
    if (role === "Contractor") {
      return (
        <div>
          <button>Dashboard</button>
          <button>Assigned Projects</button>
        </div>
      )
    }
  
    return null
  }
  
  export default Navbar
  