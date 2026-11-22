import TeachingAdmin from "./TeachingAdmin.jsx";
export const metadata={title:"Teaching Setup · School Portal",robots:{index:false,follow:false}};
export default async function Page({params}){const {code}=await params;return <TeachingAdmin code={code}/>;}