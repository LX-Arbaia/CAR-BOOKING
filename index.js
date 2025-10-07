const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
admin.initializeApp();
const db = admin.firestore();

// Email config - set via: firebase functions:config:set mail.user="..." mail.pass="..." mail.host="..." mail.port=587
const mailUser = functions.config().mail ? functions.config().mail.user : 'no-reply@example.com';
const mailPass = functions.config().mail ? functions.config().mail.pass : 'password';
const mailHost = functions.config().mail ? functions.config().mail.host : 'smtp.example.com';
const mailPort = functions.config().mail ? functions.config().mail.port : 587;

const transporter = nodemailer.createTransport({
  host: mailHost,
  port: mailPort,
  secure: mailPort == 465,
  auth: { user: mailUser, pass: mailPass },
});

// Create default admin user (call once)
exports.createDefaultAdmin = functions.https.onRequest(async (req, res) => {
  try {
    const email = 'sayed.shazly@lxpantos.com';
    const password = 'Pantos@2025';
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (err) {
      userRecord = await admin.auth().createUser({ email, password });
      await db.collection('users').doc(userRecord.uid).set({ name: 'Admin', email, role: 'admin' });
    }
    res.send('Admin user ensured.');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Booking created email trigger
exports.onBookingCreated = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap) => {
    const booking = snap.data();
    if (!booking) return;
    const userRef = db.collection('users').doc(booking.userId);
    const userDoc = await userRef.get();
    const user = userDoc.exists ? userDoc.data() : { email: booking.userEmail };

    const mailOptions = {
      from: mailUser,
      to: `sayed.shazly@lxpantos.com, ${user.email}`,
      subject: `New booking for ${booking.carName}`,
      text: `Booking details:\nUser: ${user.email}\nCar: ${booking.carName}\nFrom: ${booking.startTime}\nTo: ${booking.endTime}\nReason: ${booking.reason}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Booking email sent');
    } catch (err) {
      console.error('Error sending booking email', err);
    }
  });

// Admin callable to create user
exports.createUserByAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const adminUser = await db.collection('users').doc(context.auth.uid).get();
  if (!adminUser.exists || adminUser.data().role !== 'admin') throw new functions.https.HttpsError('permission-denied', 'Admins only');

  const { email, password, role } = data;
  const userRecord = await admin.auth().createUser({ email, password });
  await db.collection('users').doc(userRecord.uid).set({ email, name: email.split('@')[0], role: role || 'employee' });
  return { success: true, uid: userRecord.uid };
});

// Admin callable to reset password
exports.resetPasswordByAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const adminUser = await db.collection('users').doc(context.auth.uid).get();
  if (!adminUser.exists || adminUser.data().role !== 'admin') throw new functions.https.HttpsError('permission-denied', 'Admins only');

  const { email, newPassword } = data;
  const userRecord = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(userRecord.uid, { password: newPassword });
  return { success: true };
});

// Auto reject conflicting bookings when one is approved
exports.onBookingStatusUpdate = functions.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status === 'approved' || after.status !== 'approved') return;

    const booking = after;
    const carId = booking.carId;
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);

    const snapshot = await admin.firestore()
      .collection('bookings')
      .where('carId', '==', carId)
      .where('status', 'in', ['pending', 'approved'])
      .get();

    const batch = admin.firestore().batch();

    snapshot.forEach(docSnap => {
      const b = docSnap.data();
      if (docSnap.id === context.params.bookingId) return; // skip self
      const existingStart = new Date(b.startTime);
      const existingEnd = new Date(b.endTime);
      const overlap = start < existingEnd && end > existingStart;

      if (overlap && b.status !== 'rejected') {
        const ref = admin.firestore().collection('bookings').doc(docSnap.id);
        batch.update(ref, { status: 'rejected', autoRejected: true });
      }
    });

    await batch.commit();
    console.log('Overlapping bookings auto-rejected for', carId);
  });
