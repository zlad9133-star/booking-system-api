require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: { type: String, select: false },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
}, { timestamps: true });

const serviceSchema = new mongoose.Schema({
  name: String,
  description: String,
  duration: Number,
  price: Number,
  active: { type: Boolean, default: true }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);

async function seed() {
  if (!process.env.MONGO_URI || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('أكمل إعدادات قاعدة البيانات والمدير في ملف البيئة');
  await mongoose.connect(process.env.MONGO_URI);
  const email = process.env.ADMIN_EMAIL.toLowerCase();
  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await User.findOneAndUpdate({ email }, { name: process.env.ADMIN_NAME || 'Site Admin', email, password, role: 'admin' }, { upsert: true, new: true });
  const defaults = [
    { name: 'استشارة أولية', description: 'جلسة تعارف وتحديد الاحتياجات', duration: 30, price: 150 },
    { name: 'جلسة متابعة', description: 'متابعة وتقييم التقدم', duration: 45, price: 220 },
    { name: 'جلسة متخصصة', description: 'جلسة تفصيلية حسب الخدمة المطلوبة', duration: 60, price: 300 }
  ];
  for (const item of defaults) await Service.updateOne({ name: item.name }, { $setOnInsert: item }, { upsert: true });
  await mongoose.disconnect();
  process.stdout.write('تم تجهيز حساب المدير والخدمات التجريبية\n');
}
seed().catch(error => { process.stderr.write(error.message + '\n'); process.exit(1); });
