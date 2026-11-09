require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true }));
app.use(express.json({ limit: '20kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
}, { timestamps: true });

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  duration: { type: Number, min: 10, max: 480, required: true },
  price: { type: Number, min: 0, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  customerName: { type: String, required: true, trim: true, maxlength: 80 },
  customerPhone: { type: String, required: true, trim: true, maxlength: 25 },
  date: { type: String, required: true, match: /^\\d{4}-\\d{2}-\\d{2}$/ },
  time: { type: String, required: true, match: /^([01]\\d|2[0-3]):[0-5]\\d$/ },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  notes: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true });

bookingSchema.index({ service: 1, date: 1, time: 1 }, {
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } }
});

const User = mongoose.model('User', userSchema);
const Service = mongoose.model('Service', serviceSchema);
const Booking = mongoose.model('Booking', bookingSchema);

const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const tokenFor = user => jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const safeUser = user => ({ id: user._id, name: user.name, email: user.email, role: user.role });

const auth = asyncRoute(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.sub);
  if (!user) return res.status(401).json({ message: 'جلسة الدخول غير صالحة' });
  req.user = user;
  next();
});

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'هذه الصلاحية للمدير فقط' });
  next();
};

app.get('/api/health', (req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || String(password).length < 8) {
    return res.status(400).json({ message: 'أدخل الاسم والبريد وكلمة مرور لا تقل عن 8 أحرف' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedEmail)) return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) return res.status(409).json({ message: 'هذا البريد مسجل بالفعل' });
  const passwordHash = await bcrypt.hash(String(password), 12);
  const user = await User.create({ name, email: normalizedEmail, password: passwordHash });
  res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', token: tokenFor(user), user: safeUser(user) });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').trim().toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(String(password || ''), user.password))) {
    return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
  }
  res.json({ message: 'تم تسجيل الدخول', token: tokenFor(user), user: safeUser(user) });
}));

app.get('/api/auth/me', auth, (req, res) => res.json({ user: safeUser(req.user) }));

app.get('/api/services', asyncRoute(async (req, res) => {
  const services = await Service.find({ active: true }).sort({ createdAt: -1 });
  res.json({ services });
}));

app.post('/api/services', auth, adminOnly, asyncRoute(async (req, res) => {
  const { name, description, duration, price } = req.body || {};
  if (!name || !Number.isFinite(Number(duration)) || !Number.isFinite(Number(price)) || Number(duration) < 10 || Number(price) < 0) {
    return res.status(400).json({ message: 'راجع اسم الخدمة والمدة والسعر' });
  }
  const service = await Service.create({ name, description, duration: Number(duration), price: Number(price) });
  res.status(201).json({ service });
}));

app.patch('/api/services/:id', auth, adminOnly, asyncRoute(async (req, res) => {
  const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!service) return res.status(404).json({ message: 'الخدمة غير موجودة' });
  res.json({ service });
}));

app.post('/api/bookings', auth, asyncRoute(async (req, res) => {
  const { serviceId, customerName, customerPhone, date, time, notes } = req.body || {};
  if (!serviceId || !customerName || !customerPhone || !date || !time) return res.status(400).json({ message: 'أكمل بيانات الحجز المطلوبة' });
  const service = await Service.findOne({ _id: serviceId, active: true });
  if (!service) return res.status(404).json({ message: 'الخدمة غير متاحة' });
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(time)) return res.status(400).json({ message: 'التاريخ أو الوقت غير صحيح' });
  if (date < new Date().toISOString().slice(0, 10)) return res.status(400).json({ message: 'لا يمكن الحجز في تاريخ سابق' });
  const booking = await Booking.create({ user: req.user._id, service: service._id, customerName, customerPhone, date, time, notes });
  res.status(201).json({ message: 'تم إرسال طلب الحجز', booking });
}));

app.get('/api/bookings/mine', auth, asyncRoute(async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id }).populate('service', 'name duration price').sort({ date: -1, time: -1 });
  res.json({ bookings });
}));

app.patch('/api/bookings/:id/cancel', auth, asyncRoute(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
  if (!booking) return res.status(404).json({ message: 'الحجز غير موجود' });
  if (booking.status === 'completed') return res.status(400).json({ message: 'لا يمكن إلغاء حجز مكتمل' });
  booking.status = 'cancelled';
  await booking.save();
  res.json({ message: 'تم إلغاء الحجز', booking });
}));

app.get('/api/admin/bookings', auth, adminOnly, asyncRoute(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const bookings = await Booking.find(filter).populate('user', 'name email').populate('service', 'name duration price').sort({ date: 1, time: 1 });
  res.json({ bookings });
}));

app.patch('/api/admin/bookings/:id/status', auth, adminOnly, asyncRoute(async (req, res) => {
  const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'حالة الحجز غير صحيحة' });
  const booking = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!booking) return res.status(404).json({ message: 'الحجز غير موجود' });
  res.json({ message: 'تم تحديث حالة الحجز', booking });
}));

app.use((req, res) => res.status(404).json({ message: 'المسار غير موجود' }));
app.use((error, req, res, next) => {
  if (error.code === 11000) return res.status(409).json({ message: 'الموعد محجوز بالفعل، اختر وقتاً آخر' });
  if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: 'البيانات المرسلة غير صحيحة' });
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'انتهت صلاحية جلسة الدخول، سجل الدخول مرة أخرى' });
  console.error(error);
  res.status(500).json({ message: 'حدث خطأ غير متوقع في الخادم' });
});

const PORT = process.env.PORT || 3000;
async function start() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) throw new Error('MONGO_URI و JWT_SECRET مطلوبان');
  await mongoose.connect(process.env.MONGO_URI);
  await app.listen(PORT);
  console.log(`Mawidy API listening on port ${PORT}`);
}
if (require.main === module) start().catch(error => { console.error(error.message); process.exit(1); });
module.exports = app;
