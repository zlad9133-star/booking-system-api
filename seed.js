require('dotenv').config();
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const userSchema=new mongoose.Schema({name:String,email:{type:String,unique:true,lowercase:true},password:{type:String,select:false},role:{type:String,default:'customer'}},{timestamps:true});
const serviceSchema=new mongoose.Schema({name:String,description:String,duration:Number,price:Number,active:{type:Boolean,default:true}},{timestamps:true});
const User=mongoose.models.User||mongoose.model('User',userSchema);
const Service=mongoose.models.Service||mongoose.model('Service',serviceSchema);
async function run(){
if(!process.env.MONGO_URI||!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD)throw new Error('أكمل إعدادات قاعدة البيانات والمدير');
await mongoose.connect(process.env.MONGO_URI);
const email=process.env.ADMIN_EMAIL.toLowerCase();
await User.findOneAndUpdate({email},{name:process.env.ADMIN_NAME||'Site Admin',email,password:await bcrypt.hash(process.env.ADMIN_PASSWORD,12),role:'admin'},{upsert:true,new:true});
const services=[['استشارة أولية','جلسة تعارف وتحديد الاحتياجات',30,150],['جلسة متابعة','متابعة وتقييم التقدم',45,220],['جلسة متخصصة','جلسة تفصيلية حسب الخدمة',60,300]];
for(const[name,description,duration,price]of services)await Service.updateOne({name},{$setOnInsert:{name,description,duration,price}},{upsert:true});
await mongoose.disconnect();console.log('تم تجهيز حساب المدير والخدمات التجريبية');
}
run().catch(e=>{console.error(e.message);process.exit(1);});
