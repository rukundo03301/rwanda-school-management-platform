import LearningResources from "./LearningResources.jsx";
export const metadata={title:"Learning Library · School Portal",robots:{index:false,follow:false}};
export default async function Page({params}){const {code}=await params;return <LearningResources code={code}/>;}
