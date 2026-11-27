import SmartLearningStudio from "./SmartLearningStudio.jsx";
export const metadata={title:"Smart Learning Studio · Umurage",robots:{index:false,follow:false}};
export default async function SmartLearningStudioPage({params}){
 const {code}=await params;
 return <SmartLearningStudio code={code}/>;
}
