// Platform-owner only: human-entered monthly fees, not subscription checkout.
// Use civil dates in Africa/Kigali; never use fractional days or JS local timezone.
export function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date must be YYYY-MM-DD");
  const d = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== value) throw new Error("Invalid calendar date");
  return d;
}
export function addMonth(dateString) {
  const d = parseDate(dateString);
  const year = d.getUTCFullYear(), month = d.getUTCMonth(), day = d.getUTCDate();
  const lastDay = new Date(Date.UTC(year,month+2,0)).getUTCDate();
  return new Date(Date.UTC(year,month+1,Math.min(day,lastDay))).toISOString().slice(0,10);
}
export function kigaliDate(time = new Date()) {
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Kigali",day:"2-digit",month:"2-digit",year:"numeric"}).formatToParts(time);
  const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));
  return p.year+"-"+p.month+"-"+p.day;
}
export function dueClock(dueDate, nowDate=kigaliDate()) {
  if(!dueDate) return {state:"not_set",days:0,label:"Not scheduled"};
  const a=parseDate(dueDate), b=parseDate(nowDate);
  const diff=Math.round((a.getTime()-b.getTime())/86400000);
  return diff>0?{state:"upcoming",days:diff,label:diff+" days left"}:
    diff===0?{state:"due_today",days:0,label:"Due today"}:
    {state:"overdue",days:-diff,label:(-diff)+" days overdue"};
}
export function validateManualPayment({amountRwf,paidOn,reference,notes},today=kigaliDate()) {
  const amount=Number(amountRwf);
  if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("Enter a positive whole-RWF payment amount");
  parseDate(paidOn);
  if(paidOn>today)throw new Error("Payment date cannot be in the future");
  if(String(reference||"").length>120||String(notes||"").length>500)throw new Error("Payment details too long");
  return {amountRwf:amount,paidOn,reference:String(reference||"").trim(),notes:String(notes||"").trim(),nextDue:addMonth(paidOn)};
}
