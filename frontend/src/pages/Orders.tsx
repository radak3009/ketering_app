import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";

export default function OrdersPage() {
  const [user] = useAuthState(auth);
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const q = query(collection(db,'orders'), where('userId','==',user.uid), orderBy('createdAt','desc'));
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, [user]);

  return (
    <div>
      <h2>Moje porudžbine</h2>
      {orders.map(o => (
        <div key={o.id} style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8 }}>
          <div>Porudžbina: {o.id}</div>
          <div>Ukupno: {o.total} RSD</div>
          <div>Status: {o.status} | Preuzeto: {o.picked ? 'Da' : 'Ne'}</div>
          <div>WeekFor: {o.weekFor}</div>
        </div>
      ))}
    </div>
  );
}
