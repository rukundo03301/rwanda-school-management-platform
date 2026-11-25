import RequestsBoard from "./RequestsBoard.jsx";
export const metadata={title:"Leave and Purchase Requests"};
export default async function Page({params}){
 const {code}=await params;
 return <RequestsBoard code={code}/>;
}
