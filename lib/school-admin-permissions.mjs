// Shared, safe-to-import definitions for the school administrator permission toggles.
export const SCHOOL_ADMIN_ACTIONS=Object.freeze([
 {id:"people.read",group:"People",title:"View staff directory"},
 {id:"people.invite",group:"People",title:"Invite teachers and school staff"},
 {id:"people.manage",group:"People",title:"Revoke teacher or staff access"},
 {id:"academics.read",group:"Academics",title:"View academic years, classes and subjects"},
 {id:"academics.manage",group:"Academics",title:"Create classes, academic years and subjects"},
 {id:"audit.read",group:"Security",title:"View school administrative activity"}
]);
export const SCHOOL_ADMIN_PERMISSIONS=Object.freeze(SCHOOL_ADMIN_ACTIONS.map(a=>a.id));

export function normalizeSchoolAdminPermissions(value){
 if(!Array.isArray(value)||value.length>6||value.some(x=>typeof x!=="string"||!SCHOOL_ADMIN_PERMISSIONS.includes(x)))
   throw new Error("Invalid administrator permission selection");
 const permissions=[...new Set(value)];
 if((permissions.includes("people.invite")||permissions.includes("people.manage"))&&!permissions.includes("people.read"))
   permissions.push("people.read");
 if(permissions.includes("academics.manage")&&!permissions.includes("academics.read"))
   permissions.push("academics.read");
 return permissions;
}
