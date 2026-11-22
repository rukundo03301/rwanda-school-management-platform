// School-specific, least-privilege admission permissions.
// These are school administrator capabilities, not a user's self-selected login role.
export const ADMISSIONS_ACTIONS=Object.freeze([
 {id:"admissions.read",label:"View applications and student registry",group:"Admissions"},
 {id:"admissions.manage",label:"Review and decide applications",group:"Admissions"},
 {id:"enrollments.manage",label:"Approve class enrollment",group:"Enrollment"},
 {id:"guardians.manage",label:"Invite and unlink verified guardians",group:"Families"}
]);
export const ADMISSIONS_PERMISSIONS=Object.freeze(ADMISSIONS_ACTIONS.map(x=>x.id));
