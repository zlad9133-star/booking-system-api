# Booking System API

واجهة برمجية (REST API) بسيطة لنظام حجز مواعيد، مبنية باستخدام **Node.js** و**Express** و**MongoDB (Mongoose)**.

## المميزات
- إنشاء حجز جديد (الاسم، الهاتف، التاريخ، الوقت)
- عرض جميع الحجوزات
- دعم CORS للربط مع أي واجهة أمامية

## التقنيات
Node.js · Express 5 · Mongoose · dotenv · CORS

## التشغيل محلياً
```bash
npm install
cp .env.example .env   # ثم ضع رابط قاعدة البيانات الخاص بك
npm start
```
السيرفر يعمل على `http://localhost:3000`

## نقاط الوصول (Endpoints)
| الطريقة | المسار | الوصف |
|---|---|---|
| POST | `/api/book` | إنشاء حجز جديد — body: `{ name, phone, date, time }` |
| GET | `/api/bookings` | عرض كل الحجوزات |

## مثال
```bash
curl -X POST http://localhost:3000/api/book \
  -H "Content-Type: application/json" \
  -d '{"name":"أحمد","phone":"0100000000","date":"2026-11-01","time":"18:00"}'
```
