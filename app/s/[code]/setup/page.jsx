import SchoolSetup from "./SchoolSetup.jsx";
export const metadata={title:"Set up your school · Rwanda Education"};
export default async function SchoolSetupPage({params}) {
 const {code}=await params;
 return <SchoolSetup code={code}/>;
}
