// Choosing a role during sign-in is navigation intent, NOT authorization.
// Only school-approved, database-backed memberships determine real access.
export const SCHOOL_ROLES=Object.freeze([
 {id:"school_owner",label:"School Owner",description:"Set up your school's identity, homepage and administration",icon:"🏫"},
 {id:"school_admin",label:"Administrator",description:"Manage approved school operations and staff",icon:"🗂️"},
 {id:"teacher",label:"Teacher",description:"Assigned classes, lesson plans, homework and attendance",icon:"📚"},
 {id:"staff",label:"School Staff",description:"Your approved duties, schedules and tasks",icon:"🧑‍💼"},
 {id:"parent",label:"Parent / Guardian",description:"Verified children and class details; more features coming",icon:"👨‍👩‍👧"},
 {id:"student",label:"Student",description:"My subjects, homework, submissions and attendance",icon:"🎓"}
]);
export const SCHOOL_ROLE_IDS=Object.freeze(SCHOOL_ROLES.map(r=>r.id));
export function validSchoolRole(value){return typeof value==="string"&&SCHOOL_ROLE_IDS.includes(value);}
export function roleDetail(role){return SCHOOL_ROLES.find(r=>r.id===role)||null;}
export function schoolPortalPath(code,role){
  if(!/^RW-SCH-\d{6,16}$/.test(code)||!validSchoolRole(role))throw Error("Invalid school or role");
  return "/s/"+code+"/portal?role="+encodeURIComponent(role);
}

/** Role routing is resolved exclusively from server-verified school membership.
 * Requested URL roles are navigation hints and never grant permission.
 */
export const ROLE_HOME_PATHS=Object.freeze({
 school_owner:"admin",school_admin:"admin",teacher:"classroom",
 student:"learning",parent:"family",staff:"communications"
});
export function approvedSchoolRoles(roles){
 return [...new Set((Array.isArray(roles)?roles:[]).filter(validSchoolRole))];
}
export function resolveSchoolRole(roles,requested){
 const approved=approvedSchoolRoles(roles);
 if(!approved.length)return null;
 if(validSchoolRole(requested)&&approved.includes(requested))return requested;
 return approved.length===1?approved[0]:null;
}
export function schoolWorkspacePath(code,role){
 if(!/^RW-SCH-\d{6,16}$/.test(code)||!validSchoolRole(role))throw Error("Invalid school or role");
 return "/s/"+code+"/"+ROLE_HOME_PATHS[role];
}
