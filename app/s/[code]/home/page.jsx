import RoleHome from "./RoleHome.jsx";
export const metadata={title:"Dashboard · School Portal",robots:{index:false,follow:false}};
export default async function HomePage({params}){
 const {code}=await params;
 return <RoleHome code={code}/>;
}
