"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onOrderCreate = exports.sendReminderForNextWeekCutoff = exports.confirmPickup = exports.createOrder = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
function getNextWeekCutoff(now) {
    const cur = new Date(now);
    const day = cur.getDay();
    const diffToFriday = (5 - day + 7) % 7;
    const friday = new Date(cur);
    friday.setDate(cur.getDate() + diffToFriday);
    friday.setHours(23, 59, 0, 0);
    return friday;
}
exports.createOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    const uid = context.auth.uid;
    const { items, weekFor } = data;
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'No items provided');
    }
    if (!weekFor) {
        throw new functions.https.HttpsError('invalid-argument', 'weekFor is required');
    }
    const now = new Date();
    const cutoff = getNextWeekCutoff(now);
    const weekForDate = new Date(weekFor);
    const curMonday = new Date(now);
    const curDay = curMonday.getDay();
    const diff = (curDay + 6) % 7;
    curMonday.setDate(curMonday.getDate() - diff);
    curMonday.setHours(0, 0, 0, 0);
    const isNextWeek = weekForDate.getTime() > curMonday.getTime();
    if (isNextWeek && now.getTime() > cutoff.getTime()) {
        throw new functions.https.HttpsError('permission-denied', 'Rok za menjanje izbora za narednu nedelju je istekao (petak 23:59)');
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
    const payload = {
        notification: {
            title: 'Nova porudžbina',
            body: `Porudžbina ${ref.id} ukupno ${total} RSD`
        },
        topic: 'kitchen'
    };
    try {
        await messaging.send(payload);
    }
    catch (err) {
        console.error('FCM send error', err);
    }
    return { orderId: ref.id };
});
exports.confirmPickup = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    const { orderId, userIdFromCard } = data;
    if (!orderId || !userIdFromCard)
        throw new functions.https.HttpsError('invalid-argument', 'orderId and userIdFromCard required');
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists)
        throw new functions.https.HttpsError('not-found', 'Order not found');
    const order = orderSnap.data();
    if (order.userId !== userIdFromCard) {
        const rolesDoc = await db.collection('users').doc(context.auth.uid).get();
        const roles = rolesDoc.exists ? rolesDoc.data()?.roles || [] : [];
        if (!roles.includes('kitchen') && !roles.includes('admin')) {
            throw new functions.https.HttpsError('permission-denied', 'User mismatch');
        }
    }
    await orderRef.update({
        picked: true,
        pickedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, pickedAt: new Date().toISOString() };
});
exports.sendReminderForNextWeekCutoff = functions.pubsub.schedule('0 10 * * 4')
    .timeZone('Europe/Belgrade')
    .onRun(async (context) => {
    const now = new Date();
    const cutoff = getNextWeekCutoff(now);
    const diffMs = cutoff.getTime() - now.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (diffMs > 0 && diffMs <= oneDayMs + 60 * 1000) {
        const payload = {
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
exports.onOrderCreate = functions.firestore.document('orders/{orderId}')
    .onCreate(async (snap, context) => {
    const order = snap.data();
    const createdAt = order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate() : new Date()) : new Date();
    const dayKey = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}-${createdAt.getDate()}`;
    const counterRef = db.collection('analytics').doc(`orders-per-day-${dayKey}`);
    await counterRef.set({ count: admin.firestore.FieldValue.increment(1) }, { merge: true });
    for (const it of order.items || []) {
        const itemRef = db.collection('analytics').doc(`popularity-${it.itemId}`);
        await itemRef.set({ itemId: it.itemId, ordered: admin.firestore.FieldValue.increment(it.qty || 1) }, { merge: true });
    }
    return null;
});
//# sourceMappingURL=index.js.map