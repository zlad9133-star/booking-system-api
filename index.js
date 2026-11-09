require('dotenv').config();
const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors');
const helmet=require('helmet');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const rateLimit=require('express-rate-limit');

const app=express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:process.env.CLIENT_URL?process.env.CLIENT_URL.split(','):true}));
app.use(express.json({limit:'20kb'}));
app.use('/api',rateLimit({windowMs:15*60*1000,limit:120,standardHeaders:'draft-8',legacyHeaders:false}));

const userSchema=new mongoose.Schema({name:{type:String,required:true,trim:true,minlength:2,maxlength:80},email:{type:String,required:true,unique:true,lowercase:true,trim:true},password:{type:String,required:true,select:false},role:{type:String,enum:['customer','admin'],default:'customer'}},{timestamps:true});
const serviceSchema=new mongoose.Schema({name:{type:String,required:true,trim:true,maxlength:100},description:{type:String,default:'',maxlength:500},duration:{type:Number,required:true,min:10,max:480},price:{type:Number,required:true,min:0},active:{type:Boolean,default:true}},{timestamps:true});
const bookingSchema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},service:{type:mongoose.Schema.Types.ObjectId,ref:'Service',required:true},customerName:{type:String,required:true,trim:true,maxlength:80},customerPhone:{type:String,required:true,trim:true,maxlength:25},date:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},time:{type:String,required:true,match:/^([01]\d|2[0-3]):[0-5]\d$/},status:{type:String,enum:['pending','confirmed','cancelled','completed'],default:'pending'},notes:{type:String,default:'',maxlength:500}},{timestamps:true});
bookingSchema.index({service:1,date:1,time:1},{unique:true,partialFilterExpression:{status:{$in:['pending','confirmed']}}});
const User=mongoose.model('User',userSchema),Service=mongoose.model('Service',serviceSchema),Booking=mongoose.model('Booking',bookingSchema);
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const safe=u=>({id:u._id,name:u.name,email:u.email,role:u.role});
const token=u=>jwt.sign({sub:u._id.toString(),role:u.role},process.env.JWT_SECRET,{expiresIn:'7d'});
const auth=wrap(async(req,res,next)=>{const h=req.headers.authorization||'',t=h.startsWith('Bearer ')?h.slice(7):'';if(!t)return res.status(401).json({message:'سجل الدخول أولاً'});const p=jwt.verify(t,process.env.JWT_SECRET);req.user=await User.findById(p.sub);if(!req.user)return res.status(401).json({message:'الحساب غير موجود'});next();});
const admin=(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({message:'هذه الصلاحية للمدير فقط'});

app.get('/api/health',(req,res)=>res.json({status:'ok',database:mongoose.connection.readyState===1?'connected':'disconnected'}));
app.post('/api/auth/register',wrap(async(req,res)=>{const{name,email,password}=req.body||{};const e=String(email||'').trim().toLowerCase();if(!name||!/^\S+@\S+\.\S+$/.test(e)||String(password||'').length<8)return res.status(400).json({message:'أدخل اسماً وبريداً صحيحاً وكلمة مرور من 8 أحرف على الأقل'});if(await User.findOne({email:e}))return res.status(409).json({message:'البريد مسجل بالفعل'});const u=await User.create({name,email:e,password:await bcrypt.hash(password,12)});res.status(201).json({token:token(u),user:safe(u)});}));
app.post('/api/auth/login',wrap(async(req,res)=>{const u=await User.findOne({email:String(req.body.email||'').trim().toLowerCase()}).select('+password');if(!u||!await bcrypt.compare(String(req.body.password||''),u.password))return res.status(401).json({message:'بيانات الدخول غير صحيحة'});res.json({token:token(u),user:safe(u)});}));
app.get('/api/auth/me',auth,(req,res)=>res.json({user:safe(req.user)}));
app.get('/api/services',wrap(async(req,res)=>res.json({services:await Service.find({active:true}).sort({createdAt:-1})})));
app.post('/api/services',auth,admin,wrap(async(req,res)=>{const{name,description,duration,price}=req.body;if(!name||Number(duration)<10||Number(price)<0||!Number.isFinite(Number(duration))||!Number.isFinite(Number(price)))return res.status(400).json({message:'بيانات الخدمة غير صحيحة'});res.status(201).json({service:await Service.create({name,description,duration:Number(duration),price:Number(price)})});}));
app.patch('/api/services/:id',auth,admin,wrap(async(req,res)=>{const s=await Service.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true});if(!s)return res.status(404).json({message:'الخدمة غير موجودة'});res.json({service:s});}));
app.post('/api/bookings',auth,wrap(async(req,res)=>{const{serviceId,customerName,customerPhone,date,time,notes}=req.body||{};if(!serviceId||!customerName||!customerPhone||!date||!time)return res.status(400).json({message:'أكمل بيانات الحجز'});const s=await Service.findOne({_id:serviceId,active:true});if(!s)return res.status(404).json({message:'الخدمة غير متاحة'});if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||date<new Date().toISOString().slice(0,10))return res.status(400).json({message:'التاريخ أو الوقت غير صحيح'});const b=await Booking.create({user:req.user._id,service:s._id,customerName,customerPhone,date,time,notes});res.status(201).json({message:'تم إرسال طلب الحجز',booking:b});}));
app.get('/api/bookings/mine',auth,wrap(async(req,res)=>res.json({bookings:await Booking.find({user:req.user._id}).populate('service','name duration price').sort({date:1,time:1})})));
app.patch('/api/bookings/:id/cancel',auth,wrap(async(req,res)=>{const b=await Booking.findOne({_id:req.params.id,user:req.user._id});if(!b)return res.status(404).json({message:'الحجز غير موجود'});if(b.status==='completed')return res.status(400).json({message:'لا يمكن إلغاء حجز مكتمل'});b.status='cancelled';await b.save();res.json({message:'تم إلغاء الحجز',booking:b});}));
app.get('/api/admin/bookings',auth,admin,wrap(async(req,res)=>{const q={};if(req.query.status)q.status=req.query.status;res.json({bookings:await Booking.find(q).populate('user','name email').populate('service','name duration price').sort({date:1,time:1})});}));
app.patch('/api/admin/bookings/:id/status',auth,admin,wrap(async(req,res)=>{if(!['pending','confirmed','cancelled','completed'].includes(req.body.status))return res.status(400).json({message:'حالة غير صحيحة'});const b=await Booking.findByIdAndUpdate(req.params.id,{status:req.body.status},{new:true,runValidators:true});if(!b)return res.status(404).json({message:'الحجز غير موجود'});res.json({message:'تم تحديث حالة الحجز',booking:b});}));
app.use((req,res)=>res.status(404).json({message:'المسار غير موجود'}));
app.use((err,req,res,next)=>{if(err.code===11000)return res.status(409).json({message:'هذا الموعد محجوز بالفعل'});if(err.name==='ValidationError'||err.name==='CastError')return res.status(400).json({message:'البيانات غير صحيحة'});if(['JsonWebTokenError','TokenExpiredError'].includes(err.name))return res.status(401).json({message:'جلسة الدخول غير صالحة'});console.error(err);res.status(500).json({message:'حدث خطأ في الخادم'});});
async function start(){if(!process.env.MONGO_URI||!process.env.JWT_SECRET)throw new Error('MONGO_URI و JWT_SECRET مطلوبان');await mongoose.connect(process.env.MONGO_URI);await app.listen(process.env.PORT||3000);console.log('Mawidy API is running');}
if(require.main===module)start().catch(e=>{console.error(e.message);process.exit(1);});
module.exports=app;
