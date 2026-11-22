import PublishedReportCard from "./PublishedReportCard.jsx";
export const metadata={title:"My School Reports",robots:{index:false,follow:false}};
export default async function SchoolReportCards({params}){
 const {code}=await params;
 return <PublishedReportCard code={code}/>;
}
