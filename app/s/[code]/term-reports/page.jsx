import TermReports from "./TermReports.jsx";
export const metadata={title:"Term Reports · School Portal",robots:{index:false,follow:false}};
export default async function Page({params}){const {code}=await params;return <TermReports code={code}/>;}
