import SchoolPortal from "./SchoolPortal.jsx";
export const metadata={title:"School Portal · Rwanda Education",robots:{index:false,follow:false}};
export default async function SchoolPortalPage({params}){
 const {code}=await params;
 return <SchoolPortal code={code}/>;
}
