import ReportsManager from "./ReportsManager.jsx";
export const metadata={title:"Curriculum and School Reports",robots:{index:false,follow:false}};
export default async function ReportsManagementPage({params}){
 const {code}=await params;
 return <ReportsManager code={code}/>;
}
