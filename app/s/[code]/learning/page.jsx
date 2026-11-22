import StudentLearning from "./StudentLearning.jsx";
export const metadata={title:"My Learning · Student Portal",robots:{index:false,follow:false}};
export default async function StudentLearningPage({params}){
 const {code}=await params;
 return <StudentLearning code={code}/>;
}
