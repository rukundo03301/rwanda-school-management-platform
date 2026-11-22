import ResetSchoolPassword from "./ResetSchoolPassword.jsx";
export default async function ResetSchoolPasswordPage({params}) {
 const {code}=await params;
 return <ResetSchoolPassword code={code}/>;
}
