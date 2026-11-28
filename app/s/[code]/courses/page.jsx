import CoursesView from "./CoursesView.jsx";
export const metadata={title:"My Courses",robots:{index:false,follow:false}};
export default async function CoursesPage({params}){
 const {code}=await params;
 return <CoursesView code={code}/>;
}
