import React from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function CartPage() {
  const [user] = useAuthState(auth);
  const nav = useNavigate();
  const cart = JSON.parse(localStorage.getItem('k_cart') || '[]');

  async function placeOrderForNextWeek() {
    if (!user) return alert('Prijavi se');
    const now = new Date();
    const curDay = now.getDay();
    const diffToNextMonday = ((8 - curDay) % 7) || 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + diffToNextMonday);
    nextMonday.setHours(0,0,0,0);
    const items = cart.map((c:any) => ({ itemId: c.id, qty: c.qty, price: c.price }));
    try {
      const fn = httpsCallable(functions, 'createOrder');
      const res = await fn({ items, weekFor: nextMonday.toISOString() });
      alert('Porudžbina kreirana: ' + res.data.orderId);
      localStorage.removeItem('k_cart');
      nav('/orders');
    } catch (err:any) {
      alert('Greška: ' + (err?.message || JSON.stringify(err)));
    }
  }

  return (
    <div>
      <h2>Korpa</h2>
      <ul>
        {cart.map((c:any) => <li key={c.id}>{c.name} x {c.qty} - {c.price} RSD</li>)}
      </ul>
      <button onClick={placeOrderForNextWeek}>Poruči za narednu nedelju</button>
    </div>
  );
}
