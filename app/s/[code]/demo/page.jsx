import {notFound} from "next/navigation";
import DemoHub from "./DemoHub.jsx";
export const metadata={title:"School D | Fictional Demo Operations",robots:{index:false,follow:false}};
export default async function SchoolDemoPage({params}){
 const {code}=await params;
 // The demo fixture is deliberately restricted to the verified synthetic audit school.
 if(code!=="RW-SCH-000004")notFound();
 return <DemoHub code={code}/>;
}
