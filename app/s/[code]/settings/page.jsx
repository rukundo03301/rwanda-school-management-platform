import SchoolSettings from "./SchoolSettings.jsx";
export const metadata={title:"School Settings",robots:{index:false,follow:false}};
export default async function SettingsPage({params}){
 const {code}=await params;
 return <SchoolSettings code={code}/>;
}
