export const KINDS=["single","multi","truefalse","numeric","short","essay"];
const clean=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
export function parseNumber(v){
 if(typeof v==="number")return Number.isFinite(v)?v:null;
 if(typeof v!=="string")return null;
 const t=v.trim().replace(",",".").replace(/\s+/g,"");
 if(!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t))return null;
 const n=Number(t);return Number.isFinite(n)?n:null;
}
export function normalizeQuestions(list){
 if(!Array.isArray(list)||list.length<1||list.length>100)throw new Error("Add between 1 and 100 questions");
 return list.map((q,i)=>{
  const kind=KINDS.includes(q?.kind)?q.kind:null;
  if(!kind)throw new Error("Question "+(i+1)+": choose a question type");
  const prompt=clean(q.prompt,2000);
  if(!prompt)throw new Error("Question "+(i+1)+": write the question");
  const marks=Number(q.marks);
  if(!Number.isFinite(marks)||marks<=0||marks>100)throw new Error("Question "+(i+1)+": marks must be between 0.5 and 100");
  const out={position:i+1,kind,prompt,marks:Math.round(marks*100)/100,options:[],answer_key:null,tolerance:0};
  if(kind==="single"||kind==="multi"){
   const options=(Array.isArray(q.options)?q.options:[]).map(o=>clean(o,300));
   if(options.length<2||options.length>8||options.some(o=>!o))throw new Error("Question "+(i+1)+": give 2 to 8 filled-in choices");
   out.options=options;
   if(kind==="single"){
    const idx=Number(q.correct);
    if(!Number.isInteger(idx)||idx<0||idx>=options.length)throw new Error("Question "+(i+1)+": mark the correct choice");
    out.answer_key={index:idx};
   }else{
    const idxs=[...new Set((Array.isArray(q.correct)?q.correct:[]).map(Number))].filter(n=>Number.isInteger(n)&&n>=0&&n<options.length).sort((a,b)=>a-b);
    if(!idxs.length)throw new Error("Question "+(i+1)+": mark at least one correct choice");
    out.answer_key={indexes:idxs};
   }
  }else if(kind==="truefalse"){
   if(q.correct!==true&&q.correct!==false&&q.correct!=="true"&&q.correct!=="false")throw new Error("Question "+(i+1)+": choose True or False as the answer");
   out.answer_key={value:q.correct===true||q.correct==="true"};
  }else if(kind==="numeric"){
   const n=parseNumber(q.correct);
   if(n===null)throw new Error("Question "+(i+1)+": enter the correct number");
   const tol=q.tolerance===undefined||q.tolerance===""?0:parseNumber(q.tolerance);
   if(tol===null||tol<0)throw new Error("Question "+(i+1)+": allowed difference must be 0 or more");
   out.answer_key={value:n};out.tolerance=tol;
  }else if(kind==="short"){
   const accepted=(Array.isArray(q.correct)?q.correct:String(q.correct||"").split("\n")).map(a=>clean(a,200)).filter(Boolean).slice(0,10);
   out.answer_key=accepted.length?{accepted}:null;
  }
  return out;
 });
}
const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
export function autoMark(q,answer){
 const k=q.answer_key;
 if(q.kind==="essay"||!k)return null;
 if(answer===undefined||answer===null||answer===""||(Array.isArray(answer)&&!answer.length))return 0;
 let ok=false;
 if(q.kind==="single")ok=Number(answer)===k.index;
 else if(q.kind==="multi"){
  const a=[...new Set((Array.isArray(answer)?answer:[]).map(Number))].sort((x,y)=>x-y);
  ok=a.length===k.indexes.length&&a.every((v,i)=>v===k.indexes[i]);
 }else if(q.kind==="truefalse")ok=(answer===true||answer==="true")===k.value&&(answer===true||answer===false||answer==="true"||answer==="false");
 else if(q.kind==="numeric"){const n=parseNumber(answer);ok=n!==null&&Math.abs(n-k.value)<=Number(q.tolerance||0)+1e-9;}
 else if(q.kind==="short")ok=k.accepted.some(a=>norm(a)===norm(answer));
 return ok?Number(q.marks):0;
}
export function cleanAnswers(questions,raw){
 const out={};
 for(const q of questions){
  const v=raw?.[q.id];
  if(v===undefined||v===null)continue;
  if(q.kind==="single"){const n=Number(v);if(Number.isInteger(n)&&n>=0&&n<q.options.length)out[q.id]=n;}
  else if(q.kind==="multi"){if(Array.isArray(v))out[q.id]=[...new Set(v.map(Number))].filter(n=>Number.isInteger(n)&&n>=0&&n<q.options.length).sort((a,b)=>a-b);}
  else if(q.kind==="truefalse"){if(v===true||v===false||v==="true"||v==="false")out[q.id]=v===true||v==="true";}
  else if(typeof v==="string"||typeof v==="number")out[q.id]=String(v).slice(0,q.kind==="essay"?5000:500);
 }
 return out;
}
export function publicQuestion(q){return {id:q.id,position:q.position,kind:q.kind,prompt:q.prompt,options:q.options,marks:Number(q.marks)};}
export function answered(answers){return Object.values(answers).filter(v=>v!==""&&!(Array.isArray(v)&&!v.length)).length;}
