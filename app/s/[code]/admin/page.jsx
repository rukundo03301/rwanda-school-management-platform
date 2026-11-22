import SchoolAdmin from "./SchoolAdmin.jsx";
export const metadata={title:"School Administration",robots:{index:false,follow:false}};
export default async function SchoolAdminPage({params}){
 const {code}=await params;
 return <SchoolAdmin code={code}/>;
}
