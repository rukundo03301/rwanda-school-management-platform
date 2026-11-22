import { dueClock, kigaliDate } from "./billing-clock.mjs";
import { formatRwf } from "./money.mjs";

// Private operator-only digest; no school user or financial recipient sees this.
export function buildOwnerDigest(rows,{today=kigaliDate(),windowDays=7}={}) {
  if(!Number.isInteger(windowDays)||windowDays<1||windowDays>30)throw new Error("Reminder window must be 1–30 days");
  const dueSoon=[],dueToday=[],overdue=[];
  for(const entry of rows) {
    if(!entry?.next_due_on || !entry?.school?.name || !entry?.school?.school_code)continue;
    if(entry.school.status==="archived" || entry.school.status==="deletion_requested")continue;
    if(!Number.isSafeInteger(Number(entry.monthly_fee_rwf)) || Number(entry.monthly_fee_rwf)<=0)continue;
    const clock=dueClock(entry.next_due_on,today);
    const item={
      school:entry.school.name,code:entry.school.school_code,
      dueOn:entry.next_due_on,monthlyRwf:Number(entry.monthly_fee_rwf),
      days:clock.days,status:clock.state
    };
    if(clock.state==="overdue")overdue.push(item);
    else if(clock.state==="due_today")dueToday.push(item);
    else if(clock.state==="upcoming" && clock.days<=windowDays)dueSoon.push(item);
  }
  overdue.sort((a,b)=>b.days-a.days || a.school.localeCompare(b.school));
  dueToday.sort((a,b)=>a.school.localeCompare(b.school));
  dueSoon.sort((a,b)=>a.days-b.days || a.school.localeCompare(b.school));
  const all=[...overdue,...dueToday,...dueSoon];
  const totalDueRwf=all.reduce((n,i)=>n+i.monthlyRwf,0);
  if(!Number.isSafeInteger(totalDueRwf))throw new Error("Digest total is too large");
  return {today,windowDays,overdue,dueToday,dueSoon,totalDueRwf,hasItems:all.length>0};
}

export function digestText(digest) {
  const lines=[
    "Rwanda Education Platform — Private Monthly Payment Reminders",
    "As of "+digest.today+" (Africa/Kigali)",
    "",
    "This list is for platform operators only. No school has been notified.",
    "Manually recorded payments are not independently verified bank receipts.",
    ""
  ];
  function section(label,rows){
    lines.push(label+" ("+rows.length+")");
    if(!rows.length){lines.push("None.");lines.push("");return;}
    for(const row of rows) {
      const timing=row.status==="overdue" ? row.days+" days overdue" :
        row.status==="due_today" ? "due today" : "due in "+row.days+" days";
      lines.push("- "+row.school+" ["+row.code+"] | "+row.dueOn+" | "+formatRwf(row.monthlyRwf)+" | "+timing);
    }
    lines.push("");
  }
  section("Past due",digest.overdue);
  section("Due today",digest.dueToday);
  section("Due within "+digest.windowDays+" days",digest.dueSoon);
  lines.push("Total listed monthly fees: "+formatRwf(digest.totalDueRwf));
  lines.push("Mark payments as received only after you personally confirm them.");
  return lines.join("\n");
}
