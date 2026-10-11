/* 🐋 كنوز الحوت — اللبّ الخالص · V1.0
   ═══════════════════════════════════════════════════════════════════════
   كلّ ما في هذا الملف دوالّ خالصة: لا DOM ولا شبكة ولا تخزين. تُحمَّل في
   الصفحة بوسم script، وتُختبر في node مباشرةً (tools/test_kanz.js).
   ⇒ أي قاعدةٍ ماليّة أو قاعدة لعبٍ تُكتب هنا لا في app.js، كي يحرسها اختبار.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";

/* ═══════════ الأرقام والمال — منقولة حرفياً من clearing.html / index.js ═══════════
   لا تُعدَّل هنا وحدها: أي تغيير يُنقل إلى الستة معاً
   (index.js · Code.gs · Nhleman.html · Restaurant.html · clearing.html · kanz/core.js). */
function toLatinDigits(s){
  return String(s===null||s===undefined?"":s)
    .replace(/[٠-٩]/g,function(d){return String.fromCharCode(d.charCodeAt(0)-0x0660+48);})
    .replace(/[۰-۹]/g,function(d){return String.fromCharCode(d.charCodeAt(0)-0x06F0+48);});
}
function parseAmount(raw,opts){
  opts=opts||{};
  const s0=toLatinDigits(raw).trim();
  if(s0==="")return{ok:false,value:null,reason:"empty"};
  let s=s0.replace(/[\s ٬]/g,"").replace(/د\.?ع|IQD|iqd|دينار/g,"");
  let neg=false;
  if(/^-/.test(s)){neg=true;s=s.slice(1);}
  else if(/-$/.test(s)){neg=true;s=s.slice(0,-1);}
  if(s==="")return{ok:false,value:null,reason:"no_digits"};
  if(/[^0-9.,]/.test(s))return{ok:false,value:null,reason:"bad_chars",got:s0};
  const seps=s.match(/[.,]/g)||[];
  if(seps.length>0){
    const parts=s.split(/[.,]/),tail=parts.slice(1);
    if(tail.every(function(p){return p.length===3;})&&parts[0].length>=1)s=parts.join("");
    else if(seps.length===1&&tail[0].length>0&&tail[0].length<3)
      return{ok:false,value:null,reason:"ambiguous_decimal",got:s0};
    else return{ok:false,value:null,reason:"bad_separators",got:s0};
  }
  if(!/^\d+$/.test(s))return{ok:false,value:null,reason:"not_integer",got:s0};
  const n=Number(s);
  if(!isFinite(n))return{ok:false,value:null,reason:"overflow",got:s0};
  if(neg&&opts.allowNegative!==true)return{ok:false,value:null,reason:"negative_not_allowed",got:s0};
  return{ok:true,value:neg?-n:n,reason:null};
}
function cleanNumber(val){
  const r=parseAmount(val,{allowNegative:true});
  return r.ok?r.value:0;
}
function monthlySubAmount(commRaw){
  const s=String(commRaw==null?"":commRaw);
  if(s.indexOf("شهري")===-1&&s.toLowerCase().indexOf("monthly")===-1)return null;
  return cleanNumber(s.replace(/اشتراك|شهري|monthly/gi,""));
}
/* مطابقة حرفية لـnormalizePhone في Code.gs و index.js */
function nP(raw){
  if(!raw)return"";
  let c=toLatinDigits(String(raw).trim()).replace(/\D/g,"");
  if(c.indexOf("964")===0)c=c.substring(3);
  return c.replace(/^0+/,"");
}

/* ═══════════ النصّ العربي: تطبيعٌ للبحث ولتجميع المناطق ═══════════ */
function normAr(s){
  return toLatinDigits(s).toLowerCase()
    .replace(/[ً-ْٰـ]/g,"")
    .replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/ظ/g,"ض")
    .replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/گ/g,"ك").replace(/چ/g,"ج").replace(/پ/g,"ب")
    .replace(/[^ء-ي0-9a-z]+/g," ").trim()
    .split(" ").map(function(w){return w.length>3&&w.indexOf("ال")===0?w.slice(2):w;}).join(" ");
}

/* ═══════════ الجغرافيا ═══════════ */
const KIRKUK={lat:35.4681,lng:44.3922};
const GEO_MAX_M=30000;   /* أبعد من هذا عن مركز كركوك ⇒ إحداثياتٌ مُدخلة خطأً، لا تدخل «الأقرب» */
function hav(a,b,c,d){
  const R=6371000,r=Math.PI/180,x=(c-a)*r,y=(d-b)*r;
  const h=Math.sin(x/2)*Math.sin(x/2)+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)*Math.sin(y/2);
  return 2*R*Math.asin(Math.sqrt(h));
}
function geoOk(lat,lng){
  lat=Number(lat);lng=Number(lng);
  if(!isFinite(lat)||!isFinite(lng)||!lat||!lng)return false;
  if(Math.abs(lat)>90||Math.abs(lng)>180)return false;
  return hav(lat,lng,KIRKUK.lat,KIRKUK.lng)<=GEO_MAX_M;
}
function fmtDist(m){
  if(m==null||!isFinite(m))return"";
  if(m<950)return Math.max(10,Math.round(m/10)*10)+" م";
  return (Math.round(m/100)/10)+" كم";
}

/* ═══════════ المناطق ═══════════
   حقل «المنطقة» نصٌّ حرّ كتبه كلّ مطعمٍ بطريقته: ١٩٧ صيغة لـ٢٦٤ مطعماً
   («ساحه طيران» · «ساحة طيران» · «شارع قدس» · «شارع القدس قرب بقالية…»).
   فلترٌ على النصّ الخام عديم النفع. فنستخرج مفتاحاً مطبَّعاً (أول كلمةٍ ذات
   معنى)، والمفتاح الذي يتكرّر ٣ مرّات فأكثر يصير «منطقة» مركزها وسيط
   إحداثيات أعضائها. ومن لم يُعرف مفتاحه يُسنَد لأقرب مركزٍ جغرافياً. */
const GENERIC={"شارع":1,"حي":1,"ساحه":1,"طريق":1,"سوق":1,"سوك":1,"نزول":1,"نزوال":1,"تقاطع":1,
  "جسر":1,"محله":1,"منطقه":1,"دور":1,"فلكه":1,"مجمع":1,"قرب":1,"مقابل":1,"مقابيل":1,"خلف":1,"مجاور":1,"راس":1};
const ZONE_MIN=3, ZONE_NEAR_M=1500, ZONE_MERGE_M=900;
function zoneTokens(area){
  const t=normAr(area).split(" ").filter(Boolean);
  while(t.length&&(t[0]==="كركوك"||t[0]==="في"))t.shift();
  return t;
}
function zoneKey(area){
  const t=zoneTokens(area);
  if(!t.length)return"";
  if(GENERIC[t[0]])return t[1]||"";
  return t[0];
}
/* الاسم المعروض: الكلمات الأصلية المقابلة للمفتاح («شارع القدس» لا «قدس») */
function zoneLabelOf(area){
  const raw=String(area||"").replace(/\s+/g," ").trim().split(" ");
  let i=0;
  while(i<raw.length&&(normAr(raw[i])==="كركوك"||normAr(raw[i])==="في"))i++;
  if(i>=raw.length)return"";
  if(GENERIC[normAr(raw[i])]&&raw[i+1])return raw[i]+" "+raw[i+1];
  return raw[i];
}
function median(a){a=a.slice().sort(function(x,y){return x-y;});return a.length?a[a.length>>1]:0;}
function editDist1(a,b){
  if(a===b)return true;
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,d=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue;}
    if(++d>1)return false;
    if(a.length>b.length)i++;else if(a.length<b.length)j++;else{i++;j++;}
  }
  return d+(a.length-i)+(b.length-j)<=1;
}
/* list: [{phone, area, lat, lng}] ⇒ {zones:[{id,label,n,lat,lng}], of:{phone:id}} */
function buildZones(list){
  const g={};
  list.forEach(function(r){const k=zoneKey(r.area);r._zk=k;if(k)(g[k]=g[k]||[]).push(r);});
  let centers=Object.keys(g).filter(function(k){return g[k].length>=ZONE_MIN;}).map(function(k){
    const m=g[k].filter(function(r){return geoOk(r.lat,r.lng);});
    const labels={};
    g[k].forEach(function(r){const l=zoneLabelOf(r.area);if(l)labels[l]=(labels[l]||0)+1;});
    const label=Object.keys(labels).sort(function(a,b){return labels[b]-labels[a]||a.length-b.length;})[0]||k;
    return{id:k,label:label,keys:[k],n:g[k].length,lat:m.length?median(m.map(function(r){return Number(r.lat);})):null,
           lng:m.length?median(m.map(function(r){return Number(r.lng);})):null};
  }).sort(function(a,b){return b.n-a.n;});
  /* دمج الصيغتين المتقاربتين لفظاً ومكاناً («قوريا» و«قوريه») */
  const merged=[];
  centers.forEach(function(c){
    const host=merged.find(function(m){
      return editDist1(m.id,c.id)&&m.lat!=null&&c.lat!=null&&hav(m.lat,m.lng,c.lat,c.lng)<=ZONE_MERGE_M;
    });
    if(host){host.keys.push(c.id);host.n+=c.n;}
    else merged.push(c);
  });
  centers=merged;
  const keyTo={};
  centers.forEach(function(c){c.keys.forEach(function(k){keyTo[k]=c.id;});});
  const of={};
  list.forEach(function(r){
    let z;
    if(r._zk&&keyTo[r._zk])z=keyTo[r._zk];
    else if(geoOk(r.lat,r.lng)){
      let best=null,bd=Infinity;
      centers.forEach(function(c){
        if(c.lat==null)return;
        const d=hav(Number(r.lat),Number(r.lng),c.lat,c.lng);
        if(d<bd){bd=d;best=c;}
      });
      z=(best&&bd<=ZONE_NEAR_M)?best.id:"_other";
    }else z="_other";
    of[r.phone]=z;
    delete r._zk;
  });
  const zones=centers.map(function(c){return{id:c.id,label:c.label,lat:c.lat,lng:c.lng};});
  zones.push({id:"_other",label:"مناطق أخرى",lat:null,lng:null});
  return{zones:zones,of:of};
}

/* ═══════════ فئة الكنز ═══════════ */
const TIERS=[
  {id:"boss",min:100000,icon:"👑",name:"كنز الزعيم"},
  {id:"gem", min:50000, icon:"💎",name:"جوهرة"},
  {id:"chest",min:10000,icon:"💰",name:"صندوق"},
  {id:"coin",min:0,     icon:"🪙",name:"صرّة"}
];
function tier(debt){
  debt=Number(debt)||0;
  for(let i=0;i<TIERS.length;i++)if(debt>=TIERS[i].min)return TIERS[i];
  return TIERS[TIERS.length-1];
}

/* ═══════════ حالة طلب التصفير ═══════════
   الطلب تحت clearing_requests/{هاتف المطعم} واحدٌ لكلّ مطعم. ويصير
   «مستهلَكاً» حين يُصفّر المدير الدين: ختم ledgers/reset_events أحدث من الطلب.
   ⇒ none (لا طلب قائم) · pending · approved · rejected */
function tsMs(v){
  if(v==null||v==="")return 0;
  if(typeof v==="number")return v<1e12?v*1000:v;
  const t=Date.parse(v);return isFinite(t)?t:0;
}
function reqState(req,resetIso){
  if(!req)return"none";
  if(tsMs(resetIso)>tsMs(req.ts))return"none";
  const s=String(req.status||"pending");
  return(s==="approved"||s==="rejected")?s:"pending";
}
/* هل يحقّ للّيدر رفع طلبٍ الآن؟ لا طلب قائم، أو القائم مرفوض (يُعاد بعد تصحيح). */
function canSubmit(req,resetIso){
  const s=reqState(req,resetIso);
  return s==="none"||s==="rejected";
}
/* المبلغ المقبوض: صحيحٌ موجب لا يتجاوز الدين الحيّ. */
function checkReceived(raw,liveDebt){
  const r=parseAmount(raw);
  if(!r.ok)return{ok:false,msg:r.reason==="empty"?"اكتب المبلغ الذي استلمتَه":"المبلغ غير مفهوم — اكتبه أرقاماً فقط"};
  if(r.value<=0)return{ok:false,msg:"المبلغ يجب أن يكون أكبر من صفر"};
  const cap=Math.ceil(Number(liveDebt)||0);
  if(r.value>cap)return{ok:false,msg:"المبلغ أكبر من دين المطعم ("+cap+")"};
  return{ok:true,value:r.value,full:r.value>=Math.floor(Number(liveDebt)||0)};
}

/* ═══════════ سجلّ الليدر وحالته ═══════════
   collector_log/{الليدر}/{id} = {res,name,amount,debt,kind:'debt'|'sub',month?,ts,dist_m?}
   والحالة تُستنتج ممّا فعله المدير — فالذهب «المؤكَّد» هو ما صُفِّر فعلاً. */
function logStates(entries,REQS,RESETS,SUBS){
  const out={},byRes={};
  entries.forEach(function(e){if(e.kind!=="sub")(byRes[e.res]=byRes[e.res]||[]).push(e);});
  Object.keys(byRes).forEach(function(res){byRes[res].sort(function(a,b){return tsMs(a.ts)-tsMs(b.ts);});});
  entries.forEach(function(e){
    if(e.kind==="sub"){
      const rec=((SUBS||{})[e.month]||{})[e.res];
      if(rec&&rec.ts===e.ts)out[e.id]=rec.status==="approved"?"confirmed":(rec.status==="rejected"?"rejected":"pending");
      else out[e.id]=rec?"rejected":"pending";      /* دُهس بتسجيلٍ أحدث ⇒ كان مرفوضاً */
      return;
    }
    const req=(REQS||{})[e.res],rst=tsMs((RESETS||{})[e.res]),t=tsMs(e.ts);
    if(req&&req.ts===e.ts){
      out[e.id]=rst>t?"confirmed":(req.status==="rejected"?"rejected":"pending");
      return;
    }
    /* ليس الطلب القائم: إمّا أُعيد رفعه بعد رفض، وإمّا صُفِّر وكُنس */
    /* «أُعيد رفعه»: سجلٌّ أحدث للمطعم نفسه خلال ١٤ يوماً **ولا تصفير بينهما** */
    const later=byRes[e.res].some(function(x){
      const xt=tsMs(x.ts);
      return xt>t&&xt-t<14*86400000&&!(rst>t&&rst<xt);
    });
    out[e.id]=later?"rejected":(rst>t?"confirmed":"pending");
  });
  return out;
}

/* ═══════════ اللعبة ═══════════ */
function baghdadDay(ts){
  const d=new Date(tsMs(ts)+3*3600000);
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
}
function baghdadHour(ts){return new Date(tsMs(ts)+3*3600000).getUTCHours();}
const ONSITE_M=150;
function xpFor(e){
  let x=10+Math.min(40,Math.round((Number(e.amount)||0)/5000));
  if(e.dist_m!=null&&e.dist_m<=ONSITE_M)x+=5;
  return x;
}
const LEVELS=[
  {xp:0,   icon:"🐟",name:"سمكة صغيرة"},
  {xp:60,  icon:"🦀",name:"سلطعون الشاطئ"},
  {xp:160, icon:"🐙",name:"أخطبوط ماهر"},
  {xp:350, icon:"🐬",name:"دلفين سريع"},
  {xp:700, icon:"🦈",name:"قرش الأعماق"},
  {xp:1200,icon:"🏴‍☠️",name:"قبطان السفينة"},
  {xp:2000,icon:"🔱",name:"سيّد البحار"},
  {xp:3200,icon:"🐋",name:"الحوت الأزرق"},
  {xp:5000,icon:"👑",name:"أسطورة المحيط"}
];
function levelOf(xp){
  let i=0;
  while(i+1<LEVELS.length&&xp>=LEVELS[i+1].xp)i++;
  const cur=LEVELS[i],nxt=LEVELS[i+1]||null;
  return{n:i+1,icon:cur.icon,name:cur.name,xp:xp,base:cur.xp,next:nxt?nxt.xp:null,
         pct:nxt?Math.max(0,Math.min(100,Math.round((xp-cur.xp)/(nxt.xp-cur.xp)*100))):100};
}
function streakDays(daysSet,today){
  let n=0,d=new Date(today+"T00:00:00Z").getTime();
  if(!daysSet[today])d-=86400000;           /* اليوم لم يبدأ بعد لا يكسر السلسلة */
  for(;;){
    const k=new Date(d).toISOString().slice(0,10);
    if(!daysSet[k])break;
    n++;d-=86400000;
  }
  return n;
}
const STICKERS=[
  {id:"first",   icon:"🗝️",name:"أوّل كنز",        hint:"افتح أوّل كنز"},
  {id:"ten",     icon:"🧰",name:"عشرة كنوز",       hint:"افتح ١٠ كنوز"},
  {id:"fifty",   icon:"🏴‍☠️",name:"خمسون كنزاً",    hint:"افتح ٥٠ كنزاً"},
  {id:"hundred", icon:"🐋",name:"مئة كنز",         hint:"افتح ١٠٠ كنز"},
  {id:"gem",     icon:"💎",name:"صائد الجواهر",    hint:"استلم ٥٠ ألفاً أو أكثر من مطعمٍ واحد"},
  {id:"boss",    icon:"👑",name:"قاهر الزعماء",    hint:"استلم ١٠٠ ألف أو أكثر من مطعمٍ واحد"},
  {id:"million", icon:"🏦",name:"مليونير البحر",   hint:"اجمع مليون دينار"},
  {id:"five_day",icon:"⚡",name:"خمسة في يوم",     hint:"افتح ٥ كنوز في يومٍ واحد"},
  {id:"ten_day", icon:"🌪️",name:"إعصار",          hint:"افتح ١٠ كنوز في يومٍ واحد"},
  {id:"combo3",  icon:"🔥",name:"ثلاثية ساخنة",    hint:"افتح ٣ كنوز خلال ساعة"},
  {id:"streak3", icon:"📅",name:"ثلاثة أيام",      hint:"اجمع ٣ أيامٍ متتالية"},
  {id:"streak7", icon:"🗓️",name:"أسبوع كامل",     hint:"اجمع ٧ أيامٍ متتالية"},
  {id:"onsite10",icon:"📍",name:"في الموقع",       hint:"سجّل ١٠ استلامات وأنت عند المطعم"},
  {id:"early",   icon:"🌅",name:"طائر الصباح",     hint:"افتح كنزاً قبل العاشرة صباحاً"},
  {id:"subs5",   icon:"🎟️",name:"جامع الاشتراكات", hint:"سجّل ٥ اشتراكات"},
  {id:"zone",    icon:"🏝️",name:"جزيرة نظيفة",    hint:"أكمل كلّ كنوز منطقةٍ واحدة"}
];
const QUESTS=[
  {id:"q_count", icon:"🗝️",name:"افتح ٥ كنوز",          target:5,     kind:"count"},
  {id:"q_sum",   icon:"🪙",name:"اجمع ١٥٠ ألف دينار",    target:150000,kind:"sum"},
  {id:"q_gem",   icon:"💎",name:"اصطد جوهرة (٥٠ ألف+)",  target:1,     kind:"gem"}
];
/* entries: كلّ سجلّات الليدر · states: من logStates · todayKey: يوم بغداد · extra: {zone:true} */
function gameState(entries,states,todayKey,extra){
  const ok=entries.filter(function(e){return states[e.id]!=="rejected";})
                  .sort(function(a,b){return tsMs(a.ts)-tsMs(b.ts);});
  let xp=0,total=0,confirmed=0,pending=0,onsite=0,subs=0,maxAmt=0;
  const days={},perDay={};
  let combo=false,early=false;
  ok.forEach(function(e,i){
    const a=Number(e.amount)||0,d=baghdadDay(e.ts);
    xp+=xpFor(e);total+=a;
    if(states[e.id]==="confirmed")confirmed+=a;else pending+=a;
    if(e.dist_m!=null&&e.dist_m<=ONSITE_M)onsite++;
    if(e.kind==="sub")subs++;
    if(a>maxAmt)maxAmt=a;
    days[d]=1;perDay[d]=(perDay[d]||0)+1;
    if(i>=2&&tsMs(e.ts)-tsMs(ok[i-2].ts)<=3600000)combo=true;
    if(baghdadHour(e.ts)<10&&baghdadHour(e.ts)>=4)early=true;
  });
  const maxDay=Object.keys(perDay).reduce(function(m,k){return Math.max(m,perDay[k]);},0);
  const streak=streakDays(days,todayKey);
  let bestStreak=0,run=0,prev=0;
  Object.keys(days).sort().forEach(function(k){
    const t=Date.parse(k+"T00:00:00Z");
    run=(prev&&t-prev===86400000)?run+1:1;prev=t;
    if(run>bestStreak)bestStreak=run;
  });
  const has={
    first:ok.length>=1,ten:ok.length>=10,fifty:ok.length>=50,hundred:ok.length>=100,
    gem:maxAmt>=50000,boss:maxAmt>=100000,million:total>=1000000,
    five_day:maxDay>=5,ten_day:maxDay>=10,combo3:combo,
    streak3:bestStreak>=3,streak7:bestStreak>=7,onsite10:onsite>=10,early:early,subs5:subs>=5,
    zone:!!(extra&&extra.zone)
  };
  const today=ok.filter(function(e){return baghdadDay(e.ts)===todayKey;});
  const tSum=today.reduce(function(s,e){return s+(Number(e.amount)||0);},0);
  const tGem=today.filter(function(e){return(Number(e.amount)||0)>=50000;}).length;
  const quests=QUESTS.map(function(q){
    const v=q.kind==="count"?today.length:(q.kind==="sum"?tSum:tGem);
    return{id:q.id,icon:q.icon,name:q.name,target:q.target,value:Math.min(v,q.target),done:v>=q.target};
  });
  return{count:ok.length,xp:xp,level:levelOf(xp),total:total,confirmed:confirmed,pending:pending,
         streak:streak,stickers:STICKERS.map(function(s){return{id:s.id,icon:s.icon,name:s.name,hint:s.hint,has:!!has[s.id]};}),
         today:{count:today.length,sum:tSum,list:today},quests:quests,
         rejected:entries.length-ok.length};
}

/* ═══════════ الترشيح والترتيب ═══════════
   rows: [{phone,name,area,zone,lat,lng,debt,state,since}] · state: open|pending|approved|rejected
   opts: {q, zone, sort:'debt'|'near'|'old'|'route', show:'open'|'wait'|'all', min, me:{lat,lng}} */
function matchQuery(r,q){
  const n=normAr(q);
  if(!n)return true;
  const digits=toLatinDigits(q).replace(/\D/g,"");
  if(digits.length>=3&&String(r.phone).indexOf(digits.replace(/^0+/,""))>-1)return true;
  const hay=r._hay||(r._hay=normAr(r.name+" "+r.area));
  return n.split(" ").every(function(w){return hay.indexOf(w)>-1;});
}
function withDistance(rows,me){
  rows.forEach(function(r){
    r.dist=(me&&geoOk(r.lat,r.lng))?hav(me.lat,me.lng,Number(r.lat),Number(r.lng)):null;
  });
  return rows;
}
/* أقرب جار: يكفي لبضع عشرات من النقاط ويُحسب في أقلّ من ميلّي ثانية */
function routeNN(start,pts,max){
  const left=pts.filter(function(p){return geoOk(p.lat,p.lng);}).slice(),out=[];
  let cur={lat:start.lat,lng:start.lng},total=0;
  while(left.length&&out.length<(max||30)){
    let bi=0,bd=Infinity;
    for(let i=0;i<left.length;i++){
      const d=hav(cur.lat,cur.lng,Number(left[i].lat),Number(left[i].lng));
      if(d<bd){bd=d;bi=i;}
    }
    const p=left.splice(bi,1)[0];
    p.leg=bd;total+=bd;out.push(p);cur={lat:Number(p.lat),lng:Number(p.lng)};
  }
  return{list:out,total:total};
}
function filterSort(rows,opts){
  opts=opts||{};
  let out=rows.filter(function(r){
    if(opts.show==="open"&&!(r.state==="open"||r.state==="rejected"))return false;
    if(opts.show==="wait"&&!(r.state==="pending"||r.state==="approved"))return false;
    if(opts.zone&&r.zone!==opts.zone)return false;
    if(opts.min&&r.debt<opts.min)return false;
    return matchQuery(r,opts.q||"");
  });
  if(opts.me)withDistance(out,opts.me);
  const byDebt=function(a,b){return b.debt-a.debt||(a.name<b.name?-1:1);};
  if(opts.sort==="near"&&opts.me){
    out.sort(function(a,b){
      if(a.dist==null&&b.dist==null)return byDebt(a,b);
      if(a.dist==null)return 1;if(b.dist==null)return-1;
      return a.dist-b.dist;
    });
  }else if(opts.sort==="old"){
    /* الأقدم بلا تحصيل: من لم يُصفَّر قطّ أوّلاً، ثم الأبعد عهداً */
    out.sort(function(a,b){return(a.since||0)-(b.since||0)||byDebt(a,b);});
  }else if(opts.sort==="route"&&opts.me){
    const r=routeNN(opts.me,out,opts.routeMax||25);
    const rest=out.filter(function(x){return r.list.indexOf(x)===-1;}).sort(byDebt);
    r.list.forEach(function(x,i){x.step=i+1;});
    rest.forEach(function(x){x.step=null;});
    out=r.list.concat(rest);out.routeTotal=r.total;out.routeCount=r.list.length;
  }else out.sort(byDebt);
  return out;
}

/* ═══════════ النصوص الجاهزة ═══════════ */
function fmtNum(n){return Math.round(Number(n)||0).toLocaleString("en-US");}
function receiptText(o){
  return"🧾 وصل استلام — نحلة للتوصيل\n"+
    "المطعم: "+o.name+"\n"+
    "المبلغ المستلم: "+fmtNum(o.amount)+" د.ع\n"+
    (o.remaining>0?"المتبقّي: "+fmtNum(o.remaining)+" د.ع\n":"")+
    "التاريخ: "+o.when+"\n"+
    "المستلم: "+o.by+"\n"+
    "شكراً لتعاملكم معنا 🐋";
}
function reportText(o){
  let s="📋 حصيلة "+o.day+" — "+o.by+"\n"+
    "عدد الاستلامات: "+o.list.length+"\n"+
    "المجموع: "+fmtNum(o.sum)+" د.ع\n———\n";
  o.list.forEach(function(e,i){
    s+=(i+1)+". "+e.name+" — "+fmtNum(e.amount)+(e.kind==="sub"?" (اشتراك)":"")+"\n";
  });
  return s;
}
function monthKey(nowMs,off){
  const n=new Date(nowMs+3*3600000);
  const d=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth()+(off||0),1));
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0");
}
const AR_MONTHS=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
function monthLabel(k){const p=String(k).split("-");return(AR_MONTHS[Number(p[1])-1]||k)+" "+p[0];}
function sinceLabel(ms,now){
  if(!ms)return"لم يُحصَّل من قبل";
  const d=Math.floor((now-ms)/86400000);
  if(d<=0)return"حُصِّل اليوم";
  if(d===1)return"منذ يوم";
  if(d===2)return"منذ يومين";
  if(d<=10)return"منذ "+d+" أيام";
  return"منذ "+d+" يوماً";
}

/* ═══════════ الطباعة: صورة ⇒ أوامر ESC/POS ═══════════
   الطابعة (GOOJPRT MTP-3 · 80 مم · ESC/POS) لا تكتب العربية متّصلةً إن أُرسلت نصّاً،
   فيُرسم الوصل صورةً ويُرسَل نقطةً نقطة بأمر GS v 0. عرض الطباعة ٥٧٦ نقطة (٧٢ مم × ٨ نقاط/مم).
   يُقطَّع شرائطَ كي لا يمتلئ مخزن الطابعة عبر البلوتوث. */
const PRINT_W=576, PRINT_BAND=96;
function rasterEscPos(w,h,rgba,feed){
  const bpr=Math.ceil(w/8), out=[0x1B,0x40, 0x1B,0x61,0x01];
  for(let y0=0;y0<h;y0+=PRINT_BAND){
    const rows=Math.min(PRINT_BAND,h-y0);
    out.push(0x1D,0x76,0x30,0x00, bpr&255,bpr>>8, rows&255,rows>>8);
    for(let y=y0;y<y0+rows;y++){
      for(let bx=0;bx<bpr;bx++){
        let b=0;
        for(let k=0;k<8;k++){
          const x=bx*8+k;
          if(x<w){
            const i=(y*w+x)*4, a=rgba[i+3];
            const lum=a<128?255:(rgba[i]*0.299+rgba[i+1]*0.587+rgba[i+2]*0.114);
            if(lum<150)b|=(0x80>>k);
          }
        }
        out.push(b);
      }
    }
  }
  out.push(0x1B,0x64,(feed==null?4:feed)&255);
  return out;
}
/* سطور الوصل المطبوع — نصٌّ بلا رموزٍ ملوّنة (الطابعة أبيض وأسود) */
function receiptLines(o){
  const L=[
    {t:"نحلة للتوصيل",s:40,b:1},
    {t:"منصة الحوت",s:24},
    {rule:1},
    {t:o.kind==="sub"?"وصل استلام اشتراك":"وصل استلام",s:36,b:1},
    {gap:8},
    {t:o.name,s:32,b:1,wrap:1},
    {gap:6},
    {t:"المبلغ المستلم",s:26},
    {t:fmtNum(o.amount)+" د.ع",s:66,b:1}
  ];
  if(o.kind==="sub"&&o.month)L.push({t:"عن شهر "+monthLabel(o.month),s:28});
  if(o.remaining>0)L.push({t:"المتبقّي: "+fmtNum(o.remaining)+" د.ع",s:30,b:1});
  L.push({rule:1},{t:"التاريخ: "+o.when,s:26});
  /* التاريخ والوقت في سطرين: مقطعان رقميّان في سطرٍ عربيّ واحد ينقلب ترتيبهما */
  if(o.time)L.push({t:"الوقت: "+o.time,s:26});
  L.push({t:"المستلم: "+o.by,s:26},{gap:10},{t:"شكراً لتعاملكم معنا",s:26},{gap:6});
  return L;
}

const K={rasterEscPos:rasterEscPos,receiptLines:receiptLines,PRINT_W:PRINT_W,toLatinDigits:toLatinDigits,parseAmount:parseAmount,cleanNumber:cleanNumber,monthlySubAmount:monthlySubAmount,nP:nP,
  normAr:normAr,hav:hav,geoOk:geoOk,fmtDist:fmtDist,zoneKey:zoneKey,zoneLabelOf:zoneLabelOf,buildZones:buildZones,editDist1:editDist1,
  tier:tier,TIERS:TIERS,tsMs:tsMs,reqState:reqState,canSubmit:canSubmit,checkReceived:checkReceived,logStates:logStates,
  baghdadDay:baghdadDay,xpFor:xpFor,levelOf:levelOf,LEVELS:LEVELS,streakDays:streakDays,STICKERS:STICKERS,QUESTS:QUESTS,
  gameState:gameState,matchQuery:matchQuery,withDistance:withDistance,routeNN:routeNN,filterSort:filterSort,
  fmtNum:fmtNum,receiptText:receiptText,reportText:reportText,monthKey:monthKey,monthLabel:monthLabel,sinceLabel:sinceLabel,
  ONSITE_M:ONSITE_M,KIRKUK:KIRKUK};
if(typeof module!=="undefined"&&module.exports)module.exports=K;else root.K=K;
})(typeof window!=="undefined"?window:this);
