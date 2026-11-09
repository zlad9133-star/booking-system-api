# Mawidy — منصة حجز المواعيد

واجهة API لمنصة حجز عربية تدعم العملاء والمدير والخدمات والحجوزات.

## الوظائف
- إنشاء حساب وتسجيل الدخول باستخدام JWT.
- تخزين كلمات المرور باستخدام bcrypt.
- عرض الخدمات وإضافة/تعديل الخدمات بصلاحية المدير.
- إنشاء حجز وعرض حجوزات العميل وإلغاؤها.
- لوحة إدارة API لعرض الحجوزات وتغيير حالتها.
- منع تكرار حجز الخدمة في نفس التاريخ والوقت للحجوزات النشطة.
- حماية أساسية عبر Helmet و CORS و Rate Limiting والتحقق من البيانات.

## التشغيل
1. استخدم Node.js 20 أو أحدث.
2. نفّذ `npm install`.
3. انسخ `.env.example` إلى `.env` وأدخل رابط MongoDB وقيمة JWT سرية طويلة.
4. اضبط بيانات المدير في متغيرات البيئة.
5. نفّذ `npm run seed` لإنشاء المدير والخدمات التجريبية.
6. نفّذ `npm run dev`.

## API
| Method | Endpoint | Access |
|---|---|---|
| GET | /api/health | عام |
| POST | /api/auth/register | عام |
| POST | /api/auth/login | عام |
| GET | /api/auth/me | مسجل |
| GET | /api/services | عام |
| POST | /api/services | مدير |
| PATCH | /api/services/:id | مدير |
| POST | /api/bookings | عميل |
| GET | /api/bookings/mine | عميل |
| PATCH | /api/bookings/:id/cancel | صاحب الحجز |
| GET | /api/admin/bookings | مدير |
| PATCH | /api/admin/bookings/:id/status | مدير |

أرسل التوكن في الهيدر: `Authorization: Bearer TOKEN`.

## النشر
استضف تطبيق Node.js على Render أو Railway، واربط MongoDB Atlas، ثم اضبط MONGO_URI وJWT_SECRET وCLIENT_URL وبيانات المدير. شغّل `npm run seed` مرة واحدة. لا ترفع ملف .env إلى Git.

هذه المرحلة تنفذ الخادم وواجهات API وقاعدة البيانات. واجهة الموقع المرئية ولوحة التحكم ستُضاف في المرحلة التالية، ويلزم اختبار النشر قبل مشاركة الرابط العام.
