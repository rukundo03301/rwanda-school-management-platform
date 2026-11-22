import SchoolFees from "./SchoolFees.jsx";
export const metadata={title:"School Fees and RWF Financial Management",robots:{index:false,follow:false}};
export default async function SchoolFeesPage({params}){
 const {code}=await params;
 return <SchoolFees code={code}/>;
}
