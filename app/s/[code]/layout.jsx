import PortalFrame from "../../ui/PortalFrame.jsx";
export default async function SchoolLayout({children,params}){
 const {code}=await params;
 return <PortalFrame code={code}>{children}</PortalFrame>;
}
