import Operations from "./Operations.jsx";
export const metadata={title:"School Operations · School Portal",robots:{index:false,follow:false}};
export default async function OperationsPage({params}){
 const {code}=await params;
 return <Operations code={code}/>;
}
