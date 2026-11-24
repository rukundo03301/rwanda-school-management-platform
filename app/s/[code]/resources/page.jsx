import {notFound} from "next/navigation";
import LearningResources from "./LearningResources.jsx";
export const metadata={title:"Remezo Primary School | Learning Library",robots:{index:false,follow:false}};
export default async function Page({params}){const {code}=await params;if(code!=="RW-SCH-000004")notFound();return <LearningResources code={code}/>;}
