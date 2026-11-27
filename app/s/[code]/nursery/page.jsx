import NurseryWorkspace from "./NurseryWorkspace.jsx";
export const metadata={title:"Early Years Observations and Reports · School Portal",robots:{index:false,follow:false}};
export default async function Page({params}){
 const {code}=await params;
 return <NurseryWorkspace code={code}/>;
}
