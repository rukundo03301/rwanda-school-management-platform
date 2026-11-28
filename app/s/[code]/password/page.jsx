import PasswordChange from "./PasswordChange.jsx";
export const metadata={title:"Change my password",robots:{index:false,follow:false}};
export default async function PasswordPage({params}){
  const {code}=await params;
  return <PasswordChange code={code}/>;
}
