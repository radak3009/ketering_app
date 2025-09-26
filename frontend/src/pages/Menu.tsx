import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function MenuPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    async function load() {
      const q = query(collection(db, 'menu_items'), where('status','==','aktivan'));
      const snap = await getDocs(q);
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(arr);
    }
    load();
  }, []);

  return (
    <div>
      <h1>Meni</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
        {items.map(it => (
          <div key={it.id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <h3>{it.name}</h3>
            <p>{it.description}</p>
            <div>{it.price} RSD</div>
          </div>
        ))}
      </div>
    </div>
  );
}
