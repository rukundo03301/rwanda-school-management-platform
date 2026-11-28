import MoneyView from "./MoneyView.jsx";
export const metadata={title:"Money and Profit",robots:{index:false,follow:false}};
export default async function MoneyPage({params}){
 const {code}=await params;
 return <MoneyView code={code}/>;
}
