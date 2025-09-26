import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

function getNextWeekCutoff(now: Date): Date {
  const cur = new Date(now);
  const day = cur.getDay();
  const diffToFriday = (5 - day + 7) % 7;
  const friday = new Date(cur);
  friday.setDate(cur.getDate() + diffToFriday);
  friday.setHours(23, 59, 0, 0);
  return friday;
}

export const createOrder = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'User must be authenticated');

  const uid = auth.uid;
  const { items, weekFor } = data as { items: any[]; weekFor: string };
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new HttpsError('invalid-argument', 'No items provided');
  }
  if (!weekFor) {
    throw new HttpsError('invalid-argument', 'weekFor is required');
  }

  const now = new Date();
  const cutoff = getNextWeekCutoff(now);

  const weekForDate = new Date(weekFor);
  const curMonday = new Date(now);
  const curDay = curMonday.getDay();
  const diff = (curDay + 6) % 7;
  curMonday.setDate(curMonday.getDate() - diff);
  curMonday.setHours(0,0,0,0);

  const isNextWeek = weekForDate.getTime() > curMonday.getTime();

  if (isNextWeek && now.getTime() > cutoff.getTime()) {
    throw new HttpsError('permission-denied', 'Rok za menjanje izbora za narednu nedelju je istekao (petak 23:59)');
  }

  let total = 0;
  const orderItems = [];
  for (const it of items) {
    total += (it.price || 0) * (it.qty || 1);
    orderItems.push({
      itemId: it.itemId,
      qty: it.qty || 1,
      price: it.price || 0
    });
  }

  const orderDoc = {
    userId: uid,
    items: orderItems,
    total: total,
    status: 'created',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    weekFor: weekForDate.toISOString(),
    picked: false
  };

  const ref = await db.collection('orders').add(orderDoc);

  const payload: admin.messaging.Message = {
    notification: {
      title: 'Nova porudžbina',
      body: `Porudžbina ${ref.id} ukupno ${total} RSD`
    },
    topic: 'kitchen'
  };

  try {
    await messaging.send(payload);
  } catch (err) {
    console.error('FCM send error', err);
  }

  return { orderId: ref.id };
});

export const confirmPickup = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError('unauthenticated', 'Authentication required');

  const { orderId, userIdFromCard } = data as { orderId: string; userIdFromCard: string };
  if (!orderId || !userIdFromCard) throw new HttpsError('invalid-argument', 'orderId and userIdFromCard required');

  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError('not-found', 'Order not found');

  const order = orderSnap.data();
  if (order.userId !== userIdFromCard) {
    const rolesDoc = await db.collection('users').doc(auth.uid).get();
    const roles = rolesDoc.exists ? rolesDoc.data()?.roles || [] : [];
    if (!roles.includes('kitchen') && !roles.includes('admin')) {
      throw new HttpsError('permission-denied', 'User mismatch');
    }
  }

  await orderRef.update({
    picked: true,
    pickedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, pickedAt: new Date().toISOString() };
});

export const sendReminderForNextWeekCutoff = onSchedule({ schedule: '0 10 * * 4', timeZone: 'Europe/Belgrade' }, async () => {
  const now = new Date();
  const cutoff = getNextWeekCutoff(now);
  const diffMs = cutoff.getTime() - now.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (diffMs > 0 && diffMs <= oneDayMs + 60*1000) {
    const payload: admin.messaging.Message = {
      notification: {
        title: 'Podsetnik: zatvaranje poručivanja za narednu nedelju',
        body: 'Imate mogućnost da promenite izbor za narednu nedelju do sutra (petak 23:59).'
      },
      topic: 'users'
    };
    await messaging.send(payload).catch(err => console.error('send reminder err', err));
  }
  return null;
});

export const onOrderCreate = onDocumentCreated('orders/{orderId}', async (event) => {
  const order = event.data?.data() as any;
  if (!order) return null;
  const createdAt = order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate() : new Date()) : new Date();
  const dayKey = `${createdAt.getFullYear()}-${createdAt.getMonth()+1}-${createdAt.getDate()}`;
  const counterRef = db.collection('analytics').doc(`orders-per-day-${dayKey}`);
  await counterRef.set({ count: admin.firestore.FieldValue.increment(1) }, { merge: true });

  for (const it of order.items || []) {
    const itemRef = db.collection('analytics').doc(`popularity-${it.itemId}`);
    await itemRef.set({ itemId: it.itemId, ordered: admin.firestore.FieldValue.increment(it.qty || 1) }, { merge: true });
  }
  return null;
});
