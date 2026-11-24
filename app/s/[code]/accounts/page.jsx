import {notFound} from "next/navigation";
import TrainingAccounts from "./TrainingAccounts.jsx";
export const metadata={title:"Remezo Primary School | Training Account Setup",robots:{index:false,follow:false}};
export default async function Page({params}){const {code}=await params;if(code!=="RW-SCH-000004")notFound();return <TrainingAccounts code={code}/>;}
