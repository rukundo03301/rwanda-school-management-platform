"use client";
import {useEffect} from "react";
import {useSearchParams} from "next/navigation";
// Opens the dashboard tab named in ?tab= , including when a sidebar link changes it while the page is open.
export default function useTabParam(allowed,setTab){
 const t=useSearchParams().get("tab");
 useEffect(()=>{if(t&&allowed.includes(t))setTab(t);},[t]);
}
