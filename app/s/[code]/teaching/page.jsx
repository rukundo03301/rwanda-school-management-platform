import TeachingConsole from "./TeachingConsole.jsx";
export const metadata={title:"Teaching and Classroom · School Portal",robots:{index:false,follow:false}};
export default async function TeachingPage({params}){
 const {code}=await params;
 return <TeachingConsole code={code}/>;
}
