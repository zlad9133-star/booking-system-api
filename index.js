require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. نعمل اتصال بقاعدة البيانات (MongoDB)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// 2. نعمل "نموذج" للبيانات (Schema)
const BookingSchema = new mongoose.Schema({
  name: String,
  phone: String,
  date: String,
  time: String
});
const Booking = mongoose.model('Booking', BookingSchema);

// 3. نعمل مسار (API) عشان نحجز موعد
app.post('/api/book', async (req, res) => {
  try {
    const { name, phone, date, time } = req.body;
    const newBooking = new Booking({ name, phone, date, time });
    await newBooking.save();
    res.json({ message: '✅ تم الحجز بنجاح', booking: newBooking });
  } catch (err) {
    res.status(500).json({ error: '❌ حدث خطأ' });
  }
});

// 4. مسار عشان نشوف كل الحجوزات (للاختبار)
app.get('/api/bookings', async (req, res) => {
  const bookings = await Booking.find();
  res.json(bookings);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
