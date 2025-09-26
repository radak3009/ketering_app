import React from "react";

export default function AdminDashboard() {
  return (
    <div>
      <h1>Admin panel</h1>
      <ul>
        <li><a href="/admin/meals">Upravljanje obrocima</a></li>
        <li><a href="/admin/menus">Upravljanje jelovnicima</a></li>
        <li><a href="/admin/users">Upravljanje korisnicima</a></li>
        <li><a href="/admin/analytics">Metrike</a></li>
      </ul>
    </div>
  );
}
